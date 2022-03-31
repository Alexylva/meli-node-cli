'use strict';
/**
 * API Implementation
**/
let fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const [SUCCESS, FAILURE, WARNINGS] = [Symbol("Success"), Symbol("Failure"), Symbol("Warnings")];

/**
 * Constants
 */
let setAccessToken, getAccessToken, getAppKeys;
const API_URL = 'https://api.mercadolibre.com/';
const API_INTERVAL = 700;//ms
const BACKUP_PATH = "./.backups/"; // ❕ Later move to constants file?

function setup(accessTokenGetter, accessTokenSetter, appKeysGetter) {
  return new Promise(resolve => {
    [getAccessToken, setAccessToken, getAppKeys] =
      [accessTokenGetter, accessTokenSetter, appKeysGetter];
    resolve();
  })
}

/**
 * Used to send a request to ML API for a Access Token, that gives access to most functions.
 * 
 * @param {string} auth Auth token used to generate Access Token
 * @param {string} redirect_uri URI for where the server will send the Access Token.
 * @returns Promise for the token data.
 */
function fetchAccessToken(auth, redirect_uri) {
  const appkeys = getAppKeys();
  return request('oauth/token', 'POST',
    `grant_type=authorization_code
     &client_id=${appkeys.app_id}
     &client_secret=${appkeys.secret}
     &code=${auth}
     &redirect_uri=${redirect_uri}`, {
      'accept': 'application/json',
      'content-type': 'application/x-www-form-urlencoded'
    },
  );
}

/**
 * Implements the users/me API function, which returns current user data.
 * 
 * @returns Promise for the users/me response.
 */
function getMe() {
  return request('users/me');;
}

function getItem(mlb) {
  return request(`items/${mlb}`);
}

function getItemVari(mlb, vari) {
  return request(`items/${mlb}/variations/${vari}`);
}



/**
 * Wrapper function that automatically chooses between using the regular or variation
 * of the SKU changing function.
 * @param {string} mlb Item's MLB
 * @param {string} vari Item's Variation ID, as string
 * @param {string} sku SKU that will be assigned to the item.
 */
function changeSku(mlb, vari, sku) {
  if (!isMLBValid(mlb)) throw new Error("Invalid MLB");
  return _changeSku(mlb, vari, sku); //Has variation
}

/**
 * Reads a CSV and feeds it into the changeSku function.
 * @param {string} file Path to a file
 * @returns 
 */
function batchChangeSku(file) {
  return new Promise((resolve) => {
    let csv = require('jquery-csv');
    let fileContent;

    try {
      fileContent = fs.readFileSync(path.resolve(file), 'UTF-8');
    } catch (e) {
      return onErr("File not found", e);
    }

    let data = csv.toArrays(fileContent, {}, async (err, array) => { //Makes CSV into array
      if (err) return onErr("Error converting to CSV", e);

      for (let i = 1; i < array.length; i++) { //Loops through the array
        [mlb, vari, sku] = array[i];
        await new Promise((resolve) => { //Executes in set time interval synchronously to not overload the API.
          setTimeout(() => {
            console.log(`batch: [${i}/${array.length}] ${array[i]}`, false, false);
            changeSku(mlb, vari, sku);
            resolve();
          }, API_INTERVAL);
        })
      }
      resolve(SUCCESS);
    });
  })
}

function createTestUser() {
  const response = request('users/test_user', 'POST', { "site_id": "MLB" });
  if (!isError(response)) {
    return response;
  } else {
    throw new Error("Couldn't create new Test User.\n" + response);
  }
}

module.exports = {
  setup,
  fetchAccessToken,
  changeSku,
  batchChangeSku,
  getMe,
  getItem,
  getItemVari,
  createTestUser
}

/**
 * Auxiliary API Functions
 */

/**
 * Changes SKU for a variation.
 * 
 * @param {string} mlb Item's MLB
 * @param {string} vari Item's Variation ID, as string
 * @param {string} sku SKU that will be assigned to the item.
 * @returns 
 */
async function _changeSku(mlb, vari, sku) {
  //Get original item
  const item = await ((vari) ? getItemVari(mlb, vari) : getItem(mlb));
  if (isError(item)) return onErr('Unknown item error', item.message);

  //Get current attributes, their length and SKU
  if (!Array.isArray(item.attributes)) item.attributes = [];
  let currentSku = getSkuFromItem(item);

  //Check if it is necessary to replace the SKU, create backups
  let tag = 'ok';
  try {
    if (currentSku === sku) 
      throw {message: `SKU for ${getNotation(mlb,vari)} is already ${sku}`, tag: tag = 'unchanged'};
  } catch (e) {
    return onErr(e.message, e.tag);
  } finally {
    createBackup(mlb, item, ...(vari ? ['vari', vari]:[]), 'sku', currentSku, 'to', sku, tag);
  }

  //Changing SKU required, sends request to change
  return _changeSkuRequest(mlb, vari, sku, item);
}


/**
 * Auxiliary function that performs a request to change a variation item's SKU.
 * @param {string} mlb Item's MLB
 * @param {string} vari Item's Variation ID, as string
 * @param {string} sku SKU that will be assigned to the item.
 * @param {MLItemResponse} item Object returned by getItemVari.
 * @param {MLVariationItemResponse} item Object returned by getItemVari.
 * @returns 
 */
async function _changeSkuRequest(mlb, vari, sku, item) {
  console.log(`Changing SKU for ${getNotation(mlb,vari)} to ${sku}`, false);

  let id = (vari) ? vari : mlb;

  //Push the sku into the item attributes.
  item.attributes.push({
    id: "SELLER_SKU",
    value_name: sku
  })

  let url = `items/${mlb}` + (vari) ? `/variations/${vari}` : '';

  //Perform the request
  const response = request(url, 'PUT', {
    id: id,
    attributes: item.attributes
  });
  let apiResponse = await response;

  return _handleChangeResponse(mlb, vari, sku, item, apiResponse);
}


/**
 * Auxiliary function to perform checks on the API response object and backups.
 * @param {string} mlb Item's MLB
 * @param {string} vari Item's Variation ID, as string
 * @param {string} sku SKU that will be assigned to the item.
 * @param {MLItemResponse} item Object returned by getItemVari.
 * @param {MLSkuAlterationResponse} apiResponse Object returned by _changeSkuVariRequest
 * @returns 
 */
function _handleChangeResponse(mlb, vari, sku, item, apiResponse) {
  let oldLength, newLength, newsku, tag;
  try {
    //Sanity check the response
    if (!apiResponse || !Array.isArray(apiResponse) || !Array.isArray(apiResponse.attributes))
      throw {message: "Invalid response data.", object: apiResponse, tag: tag = 'fail-sanity'};

    if (vari) {
      //Server answers with a array of all variations, choose the one with our ID to parse.
      apiResponse = apiResponse[apiResponse.findIndex(elem => elem.id && elem.id.toString() === vari)];
      if (!apiResponse)
        throw {message: "Failed to find variation in response!", apiResponse, tag: tag = 'fail-nosuchvari'};
    }

    //Server answered with some warnings, but mostly successfully (probably?)
    if (apiResponse.warnings)
      throw {fatal: false, message: 'There were warnings on the answer.', object : apiResponse, tag: tag = 'warnings'};

    //Get some data of the answer
    newLength = apiResponse.attributes.length;
    newsku = getSkuFromItem(apiResponse);
    if (newsku !== sku)
      throw {message: "SKU wasn't set correctly\n", object: apiResponse, tag: tag = 'fail-skunotset'};

    //All good
    console.log(`${getNotation(mlb, vari)} SKU is now ${sku}`, false, false);
    oldLength = item.attributes.length;
    tag = `new-${oldLength}-${newLength}`;
  } catch (e) {
    if (e.fatal !== false) 
      return onErr(e.message, e.object, e.tag); //Halt
    onErr(e.message, e.object, e.tag); //Execution continues, non-fatal error.
  } finally {
    //Backup the data no matter what
    createBackup(mlb, apiResponse, ...(vari ? ['vari', vari]:[]), 'sku', currentSku, 'to', sku, tag);
  }
  return SUCCESS;
}


function getSkuFromItem(item) {
  let currsku;
  try {
    currsku = item.attributes[item.attributes.findIndex(elem => elem.id && elem.id === 'SELLER_SKU')].value_name;
  } catch (e) {
    currsku = "null";
  }
  return currsku;
}

function getNotation(mlb,vari) {
  if (vari)
    return `${mlb}/${vari}`
  return `${mlb}`;
}

/**
 * Request Shorthands
 */

function request(path, method = 'GET', body = '', headers = makeHeaders()) {
  const options = {
    method,
    headers
  };
  if (body) {
    if (typeof body === 'string') {
      options.body = body;
    } else if (typeof body === 'object') {
      options.body = JSON.stringify(body);
    }
  }
  return fetch(API_URL + path, options).then(response => response.json());
}

function makeHeaders() {
  const access_token = getAccessToken();
  return {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  }
}


/**
 * Validity Functions
 */

function isVariValid(vari) {
  return /^\d{7,12}$/.test(vari);
}

function isMLBValid(mlb) {
  return /^ML[A-Z]\d{9,11}$/.test(mlb);
}

function isError(response) {
  return (typeof response.error !== 'undefined' || (typeof response.status !== 'undefined' && response.status >= 300));
}

function onErr(...e) {
  console.log(e.join("\n"), true, false);
  return FAILURE;
}

/**
 * Backup Functions
 */

function createBackup(mlb, item, ...tags) { // ❕ perhaps make async?
  let backup_path = path.resolve(BACKUP_PATH); //Make absolute path

  if (!fs.existsSync(backup_path)) {
    try {
      fs.mkdirSync(backup_path, { recursive: true });
    } catch (e) {
      return onErr("Error creating backups folder", e);
    }
  }

  let backup_file = path.join(backup_path, `${mlb} (${tags.join('-')} @ ${((new Date).valueOf())}).json`);
  // -> ./backups/90170897681 (vari-tairashop @ 1647448169214).json

  try {
    fs.writeFileSync(path.resolve(backup_file), JSON.stringify(item, null, 2));
  } catch (err) {
    console.error(err);
  }

}