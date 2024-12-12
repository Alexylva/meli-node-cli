
/**
 * API Implementation
**/
let fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exit, off } = require('process');
const { v4: uuidv4 } = require('uuid');
const [SUCCESS, FAILURE, WARNINGS] = [Symbol("Success"), Symbol("Failure"), Symbol("Warnings")];

/**
 * Constants
 */
let setAccessToken, getAccessToken, getAppKeys;
const API_URL = 'https://api.mercadolibre.com/'
  , API_INTERVAL = 700//ms
  , BACKUP_PATH = "./.backups/" // ❕ Later move to constants file?
  , ADS_PATH = "./.adsoutput/"
  ;

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
    `grant_type=authorization_code` +
    `&client_id=${appkeys.app_id}` +
    `&client_secret=${appkeys.secret}` +
    `&code=${auth}` +
    `&redirect_uri=${redirect_uri}`, {
    'accept': 'application/json',
    'content-type': 'application/x-www-form-urlencoded'
  },
  );

  // Fallback
  /* curl -X POST \
  -H 'accept: application/json' \
  -H 'content-type: application/x-www-form-urlencoded' \
  'https://api.mercadolibre.com/oauth/token' \
  -d 'grant_type=authorization_code' \
  -d 'client_id=7740117095200548' \
  -d 'client_secret=ssxPhWJcrPYTJm3NZLqrwDNOhrugS7qk' \
  -d 'code=TG-6413c35c61dfa80001052c4f-486163081' \
  -d 'redirect_uri=http://localhost:63771/code'
*/
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

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Exports all ads in the current account to a CSV file
 */
async function getAllAds(filenamePrefix) {
  const csv = require('jquery-csv')
    , user = await getMe()
    , mlbsList = [["MLB"]]
    , detailedAdsList = [[
      'Code'
      , 'Item Status'
      , 'Item ID'
      , 'Title'
      , 'Subtitle'
      , 'Ad type'
      , 'Price'
      , 'Base Price'
      , 'Original Price'
      , 'Inventory ID (Body)'
      , 'Initial Quantity'
      , 'Available Quantity'
      , 'Sold Quantity'
      , 'Start Time'
      , 'Free Shipping'
      , 'Logistic Type'
      , 'Catalog Listing (Body)'
      , 'Permalink'
      , 'Video ID'
      , 'Health (Body)'
      , 'Variation ID'
      , 'Variation Price'
      , 'Variation Attribute ID'
      , 'Variation Attribute Value'
      , 'Variation Available Quantity'
      , 'Variation Sold Quantity'
      , 'Seller Custom Field'
      , 'Catalog Product ID (Variation)'
      , 'Inventory ID (Variation)'
      , 'User Product ID (Variation)'
      , 'Catalog Product ID (Body)'
      , 'Seller Custom Field (Body)'
      , 'Parent Item ID'
      , 'Date Created (Body)'
      , 'Last Updated (Body)'
    ]]
    , errorsList = [["Error", "Request", "Product"]]
    , adslimit = 20 // Imposed by the maximum amount of items allowed by items api multiget
    ;

  let scrollid = "";
  while (true) {
    // Requests the data
    console.info("Scan request")
    const req = await request(`users/${user.id}/items/search?search_type=scan&limit=${adslimit}` + scrollid);
    console.info("Scan request done")

    // Some safety API delay
    await delay(API_INTERVAL);

    // Gets the important fields
    const { paging: { limit, total }, results, scroll_id } = req;

    // Gets info on every MLB on response
    console.info("Ads request");
    const adData = await request(`items?ids=${results.join(',')}`);
    console.info("Ads request done");
    await delay(API_INTERVAL);

    // Extract data from each product
    adData.forEach(product => {
      try {
        // Attempt to extract data from the object
        detailedAdsList.push(...productJsonToArray(product));
      } catch (e) {
        // Stringify errors into array
        errorsList.push([e]);
        console.error(e);
      }
    }
    )

    // Sets the necessary ID for ML to send the next batch of data
    scrollid = `&scroll_id=${scroll_id}`;

    // Store the MLB-only list, for reasons
    mlbsList.push(...results.map(elem => [elem]));

    console.log(`(${mlbsList.length - 1} / ${total}) Processing ads (Errors: ${errorsList.length - 1} / Unique + Vari: ${detailedAdsList.length - 1})`);

    // If reached all MLBs, we're done
    if (mlbsList.length - 1 >= total) {
      break;
    }
  }

  const uuid = uuidv4()
    , mlbsCsv = csv.fromArrays(mlbsList)
    , detailedAdsCsv = csv.fromArrays(detailedAdsList)
    , errorsCsv = csv.fromArrays(errorsList)
    , ads_path = path.resolve(ADS_PATH); //Make absolute path
  ;

  createFile(path.join(ads_path, `${filenamePrefix} mlbs ${uuid}.csv`), mlbsCsv);
  createFile(path.join(ads_path, `${filenamePrefix} ads ${uuid}.csv`), detailedAdsCsv);
  createFile(path.join(ads_path, `${filenamePrefix} errors ${uuid}.csv`), errorsCsv);

  console.log("Files created");
}

/* Extracts select product fields into 2D array */
function productJsonToArray(product) {
  const { code, body: { shipping, variations }, body } = product
    , ret = []
    , makeProduct = (variation) => [
      code,
      body.status,
      body.id,
      body.title,
      body.subtitle,
      body.listing_type_id,
      parseNumberForGS(body.price),
      parseNumberForGS(body.base_price),
      parseNumberForGS(body.original_price),
      body.inventory_id,
      parseNumberForGS(body.initial_quantity),
      parseNumberForGS(body.available_quantity),
      parseNumberForGS(body.sold_quantity),
      convertISOToGMTMinus3(body.start_time),
      shipping?.free_shipping,
      shipping?.logistic_type,
      body.catalog_listing,
      body.permalink,
      body.video_id,
      body.health,
      variation?.id,
      parseNumberForGS(variation?.price),
      variation?.attribute_combinations[0]?.id, // No support for multiple variations yet :x
      variation?.attribute_combinations[0]?.value_name, // No support for multiple variations yet :x
      parseNumberForGS(variation?.available_quantity),
      parseNumberForGS(variation?.sold_quantity),
      variation?.seller_custom_field,
      variation?.catalog_product_id,
      variation?.inventory_id,
      variation?.user_product_id,
      body.catalog_product_id,
      body.seller_custom_field,
      body.parent_item_id,
      convertISOToGMTMinus3(body.date_created),
      convertISOToGMTMinus3(body.last_updated),
    ]
    ;

  // Needs a line per variation, or a single line for unique prods
  if (variations?.length > 0) {
    // Has variations
    variations.forEach(vari => {
      ret.push(makeProduct(vari));
    })
  } else {
    ret.push(makeProduct());
  }
  return ret;
}

function parseNumberForGS(numberStr) {
  let str = String(numberStr).replace('.', ',');
  if (numberStr) {
    return str;
  }
  return '';
}

function convertISOToGMTMinus3(isoDateStringGMT) {
  var date = new Date(isoDateStringGMT);
  date.setHours(date.getHours() - 3);

  var formattedDateString = date.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

  return formattedDateString;
}

// Example usage:
var isoDateStringGMT = "2023-10-05T15:30:00Z";
var formattedDateString = convertISOToGMTMinus3(isoDateStringGMT);
console.log(formattedDateString); // Output: "2023-10-05 12:30:00"


function createFile(filePath, contents) {
  // Get the directory path from the file path
  const directoryPath = path.dirname(filePath);

  // Create the directory (including parent directories) if it doesn't exist
  fs.mkdirSync(directoryPath, { recursive: true });

  // Use fs.writeFileSync to create the file and write the contents
  fs.writeFileSync(filePath, contents);

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
    let csv = require('jquery-csv'),
      fileContent,
      mlb,
      vari,
      sku;

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
            changeSku(mlb, null, sku);
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
  createTestUser,
  getAllAds
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
      throw { message: `SKU for ${getNotation(mlb, vari)} is already ${sku}`, tag: tag = 'unchanged' };
  } catch (e) {
    return onErr(e.message, e.tag);
  } finally {
    createBackup(mlb, item, ...(vari ? ['vari', vari] : []), 'sku', currentSku, 'to', sku, tag);
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
  console.log(`Changing SKU for ${getNotation(mlb, vari)} to ${sku}`, false);

  let id = (vari) ? vari : mlb;

  let hasSellerSku = item.attributes.findIndex(elem => elem.id === "SELLER_SKU"); //Removes current SELLER_SKU
  if (hasSellerSku < 0) {
    console.log(`${mlb} already has SELLER_SKU, removing`);
    item.attributes.splice(hasSellerSku);
  }

  //Push the sku into the item attributes.
  item.attributes.push({
    id: "SELLER_SKU",
    value_name: sku
  })

  let url = `items/${mlb}` + ((vari) ? `/variations/${vari}` : '');

  //Perform the request
  let reqData = { attributes: item.attributes };
  if (vari)
    reqData.id = id;

  const response = request(url, 'PUT', reqData);
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
    if (!apiResponse)
      throw { message: "Invalid response data.", object: apiResponse[0], tag: tag = 'fail-sanity' };

    if (vari) {
      //Server answers with a array of all variations, choose the one with our ID to parse.
      apiResponse = apiResponse[apiResponse.findIndex(elem => elem.id && elem.id.toString() === vari)];
      if (!apiResponse)
        throw { message: "Failed to find variation in response!", apiResponse, tag: tag = 'fail-nosuchvari' };
    }

    //Server answered with some warnings, but mostly successfully (probably?)
    if (apiResponse.warnings)
      throw { fatal: false, message: 'There were warnings on the answer.', object: apiResponse, tag: tag = 'warnings' };

    //Get some data of the answer
    newLength = apiResponse.attributes.length;
    newsku = getSkuFromItem(apiResponse);
    if (newsku !== sku)
      throw { message: "SKU wasn't set correctly\n", object: apiResponse, tag: tag = 'fail-skunotset' };

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
    createBackup(mlb, apiResponse, ...(vari ? ['vari', vari] : []), 'sku', 'to', sku, tag);
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

function getNotation(mlb, vari) {
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