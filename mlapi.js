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
  , PRICES_PATH = "./.pricesoutput/" // ADDED: directory for prices CSV files
  , IMAGES_PATH = "./.imagesoutput/" // ADDED: directory for images CSV files
  ;

function setup(accessTokenGetter, accessTokenSetter, appKeysGetter) {
  return new Promise(resolve => {
    [getAccessToken, setAccessToken, getAppKeys] =
      [accessTokenGetter, accessTokenSetter, appKeysGetter];
    resolve();
  })
}

/**
 * Used to send a request to ML API for a Access Token
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
}

/**
 * Implements the users/me API function
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
 * Exports all ads in CSV format
 */
async function getAllAds(filenamePrefix) {
  const csv = require('jquery-csv')
    , user = await getMe()
    , mlbsList = [["MLB"]]
    , detailedAdsList = [[
      'Code'
      , 'Item Status'
      , 'Item ID'
      , 'SELLER_SKU' // <<< 1. HEADER ADDED HERE
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
    , adslimit = 20
    ;

  let scrollid = "";
  while (true) {
    console.info("Scan request")
    const req = await request(`users/${user.id}/items/search?search_type=scan&limit=${adslimit}` + scrollid);
    console.info("Scan request done")

    await delay(API_INTERVAL);

    const { paging: { limit, total }, results, scroll_id } = req;

    console.info("Ads request");
    const adData = await request(`items?ids=${results.join(',')}`);
    console.info("Ads request done");
    await delay(API_INTERVAL);

    adData.forEach(product => {
      try {
        detailedAdsList.push(...productJsonToArray(product));
      } catch (e) {
        errorsList.push([e]);
        console.error(e);
      }
    })

    scrollid = `&scroll_id=${scroll_id}`;

    mlbsList.push(...results.map(elem => [elem]));

    console.log(`(${mlbsList.length - 1} / ${total}) Processing ads (Errors: ${errorsList.length - 1} / Unique + Vari: ${detailedAdsList.length - 1})`);

    if (mlbsList.length - 1 >= total) {
      break;
    }
  }

  const uuid = uuidv4()
    , mlbsCsv = csv.fromArrays(mlbsList)
    , detailedAdsCsv = csv.fromArrays(detailedAdsList)
    , errorsCsv = csv.fromArrays(errorsList)
    , ads_path = path.resolve(ADS_PATH);

  createFile(path.join(ads_path, `${filenamePrefix} mlbs ${uuid}.csv`), mlbsCsv);
  createFile(path.join(ads_path, `${filenamePrefix} ads ${uuid}.csv`), detailedAdsCsv);
  createFile(path.join(ads_path, `${filenamePrefix} errors ${uuid}.csv`), errorsCsv);

  console.log("Files created");
}

/**
 * Exports all ad images in CSV format
 */
async function getAllAdImages(filenamePrefix) {
  const csv = require('jquery-csv')
    , user = await getMe()
    , imageUrlsList = [[
      'MLB',
      'Variation ID',
      'Image Index', // ADDED: Image Index column
      'Image URL'
    ]]
    , errorsList = [["Error", "Request", "Product"]]
    , adslimit = 20 // Imposed by the maximum allowed by items api multiget
    ;

  let scrollid = "";
  let processedAdsCount = 0; // ADDED: Counter for processed ads
  while (true) {
    console.info("Scan request for images")
    const req = await request(`users/${user.id}/items/search?search_type=scan&limit=${adslimit}` + scrollid);
    console.info("Scan request done for images")

    await delay(API_INTERVAL);

    const { paging: { limit, total }, results, scroll_id } = req;

    console.info("Ads request for images");
    const adData = await request(`items?ids=${results.join(',')}`);
    console.info("Ads request done for images");
    await delay(API_INTERVAL);

    adData.forEach(product => {
      try {
        imageUrlsList.push(...productJsonToImageArray(product));
      } catch (e) {
        errorsList.push([e, "Processing Product Images", product.body?.id || 'N/A']);
        console.error(e);
      }
    })

    scrollid = `&scroll_id=${scroll_id}`;
    processedAdsCount += results.length; // ADDED: Increment processed ads count

    console.log(`(${processedAdsCount} / ${total}) Processing ad images (Errors: ${errorsList.length - 1} / Images: ${imageUrlsList.length - 1})`); // Modified log

    if (processedAdsCount >= total) { // Modified condition to check against processedAdsCount
      break;
    }
  }

  const uuid = uuidv4()
    , imageUrlsCsv = csv.fromArrays(imageUrlsList)
    , errorsCsv = csv.fromArrays(errorsList)
    , images_path = path.resolve(IMAGES_PATH); // Using IMAGES_PATH here

  createFile(path.join(images_path, `${filenamePrefix} images ${uuid}.csv`), imageUrlsCsv); // Saving to IMAGES_PATH
  createFile(path.join(images_path, `${filenamePrefix} errors ${uuid}.csv`), errorsCsv);

  console.log("Image files created");
}


/* Extracts product image URLs into 2D array */
function productJsonToImageArray(product) {
  const { code, body: { variations, pictures }, body } = product
    , ret = []
    , makeImageRow = (variation, picture, index) => [ // ADDED: index parameter
      body.id,
      variation?.id || '', // Variation ID or empty string if no variation
      index, // ADDED: Image Index
      picture.secure_url || picture.url // Use secure_url if available, otherwise url
    ];

  if (pictures && pictures.length > 0) {
    pictures.forEach((picture, index) => { // ADDED: index in forEach
      ret.push(makeImageRow(null, picture, index + 1)); // ADDED: index + 1 to start from 1
    });
  } else {
    ret.push(makeImageRow(null, { url: 'No Images Available', secure_url: 'No Images Available' }, '')); // Added empty string for index when no image
  }

  return ret;
}

/**
 * Extracts the SELLER_SKU value from the attributes array.
 * @param {object} productBody - The 'body' object of a product from the API response.
 * @returns {string|null} The seller SKU if found, otherwise null.
 */
function getSellerSku(productBody) {
  // Ensure the attributes array exists before trying to search it
  if (!productBody.attributes) {
    return null;
  }

  // Find the attribute object with the id 'SELLER_SKU'
  const skuAttribute = productBody.attributes.find(attribute => attribute.id === 'SELLER_SKU');

  // Return the 'value_name' if the attribute is found, otherwise return null
  return skuAttribute ? skuAttribute.value_name : null;
}

/* Extracts select product fields into 2D array */
function productJsonToArray(product) {
  const { code, body: { shipping, variations }, body } = product
    , ret = []
    // <<< 2. GET THE SKU FOR THE CURRENT PRODUCT
    , sellerSku = getSellerSku(body)
    , makeProduct = (variation) => [
      code,
      body.status,
      body.id,
      sellerSku, // <<< 3. ADD THE SKU TO THE OUTPUT ARRAY
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
      variation?.attribute_combinations[0]?.id,
      variation?.attribute_combinations[0]?.value_name,
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

  if (variations?.length > 0) {
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
  const directoryPath = path.dirname(filePath);
  fs.mkdirSync(directoryPath, { recursive: true });
  fs.writeFileSync(filePath, contents);
}


/**
 * Wrapper function that automatically chooses between using the regular or variation
 * of the SKU changing function.
 */
function changeSku(mlb, vari, sku) {
  if (typeof sku === 'undefined') {
    sku = vari;
    vari = undefined;
  }
  if (!isMLBValid(mlb)) throw new Error("Invalid MLB");
  return _changeSku(mlb, vari, sku);
}

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

    let data = csv.toArrays(fileContent, {}, async (err, array) => {
      if (err) return onErr("Error converting to CSV", e);

      for (let i = 1; i < array.length; i++) {
        [mlb, vari, sku] = array[i];

        await new Promise((resolve) => {
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

// ADDED: Get prices for a single item
/**
 * Retrieves prices data for a single item.
 * 
 * @param {string} mlb The item's MLB ID.
 * @returns Promise that resolves to the price response object.
 */
function getItemPrices(mlb) {
  return request(`items/${mlb}/prices`);
}

// ADDED: Extract price array data to 2D array
/**
 * Convert a price response to a 2D array for CSV.
 * @param {object} priceResponse The JSON object returned by getItemPrices.
 * @returns {array[]} A 2D array suitable for CSV export.
 */
function pricesJsonToArray(priceResponse) {
  const { id, prices } = priceResponse;
  const ret = [];
  if (!prices || !Array.isArray(prices)) return ret;

  // Columns:
  // Item ID | Price ID | Type | Amount | Regular Amount | Currency ID | Last Updated | Context Restrictions | Start Time | End Time
  prices.forEach(priceObj => {
    ret.push([
      id,
      priceObj.id,
      priceObj.type,
      parseNumberForGS(priceObj.amount),
      parseNumberForGS(priceObj.regular_amount),
      priceObj.currency_id,
      convertISOToGMTMinus3(priceObj.last_updated),
      (priceObj.conditions?.context_restrictions || []).join(';'),
      priceObj.conditions?.start_time ? convertISOToGMTMinus3(priceObj.conditions.start_time) : '',
      priceObj.conditions?.end_time ? convertISOToGMTMinus3(priceObj.conditions.end_time) : ''
    ]);
  });

  return ret;
}

// ADDED: Function to list prices for all products in CSV
/**
 * Exports all product prices in CSV format.
 * Similar approach to getAllAds: scans through all items, fetches their prices,
 * and outputs a CSV file.
 * 
 * @param {string} filenamePrefix Prefix for the output filenames.
 */
async function getAllPrices(filenamePrefix) {
  const csv = require('jquery-csv')
    , user = await getMe()
    , pricesList = [[
      'Item ID',
      'Price ID',
      'Type',
      'Amount',
      'Regular Amount',
      'Currency ID',
      'Last Updated',
      'Context Restrictions',
      'Start Time',
      'End Time'
    ]]
    , errorsList = [["Error", "Item ID"]]
    , adslimit = 20;

  let scrollid = "";
  let total = 0;
  let processedCount = 0;

  while (true) {
    console.info("Scan request for prices");
    const req = await request(`users/${user.id}/items/search?search_type=scan&limit=${adslimit}` + scrollid);
    console.info("Scan request done");
    await delay(API_INTERVAL);

    const { paging: { limit, total: totalItems }, results, scroll_id } = req;
    total = totalItems; // Keep updating total

    console.info("Fetching prices for batch of items...");
    // Fetch prices one by one to avoid overhead
    for (const mlb of results) {
      try {
        const pricesResponse = await getItemPrices(mlb);
        await delay(API_INTERVAL);
        // Check if there's an error
        if (isError(pricesResponse)) {
          errorsList.push([pricesResponse.error || 'Unknown Error', mlb]);
        } else {
          pricesList.push(...pricesJsonToArray(pricesResponse));
        }
      } catch (e) {
        errorsList.push([e.message, mlb]);
      }
      processedCount++;
      console.log(`Processed ${processedCount}/${total} items`);
    }

    scrollid = `&scroll_id=${scroll_id}`;

    if (processedCount >= total) {
      break;
    }
  }

  const uuid = uuidv4()
    , pricesCsv = csv.fromArrays(pricesList)
    , errorsCsv = csv.fromArrays(errorsList)
    , prices_path = path.resolve(PRICES_PATH);

  createFile(path.join(prices_path, `${filenamePrefix} prices ${uuid}.csv`), pricesCsv);
  createFile(path.join(prices_path, `${filenamePrefix} errors ${uuid}.csv`), errorsCsv);

  console.log("Price files created");
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
  getAllAds,
  getAllAdImages,
  getItemPrices,
  getAllPrices
}

/**
 * Auxiliary Functions
 */

async function _changeSku(mlb, vari, sku) {
  const item = await ((vari) ? getItemVari(mlb, vari) : getItem(mlb));
  if (isError(item)) return onErr('Unknown item error', item.message);

  if (!Array.isArray(item.attributes)) item.attributes = [];
  let currentSku = getSkuFromItem(item);

  let tag = 'ok';
  try {
    if (currentSku === sku)
      throw { message: `SKU for ${getNotation(mlb, vari)} is already ${sku}`, tag: tag = 'unchanged' };
  } catch (e) {
    return onErr(e.message, e.tag);
  } finally {
    createBackup(mlb, item, ...(vari ? ['vari', vari] : []), 'sku', currentSku, 'to', sku, tag);
  }

  return _changeSkuRequest(mlb, vari, sku, item);
}

async function _changeSkuRequest(mlb, vari, sku, item) {
  console.log(`Changing SKU for ${getNotation(mlb, vari)} to ${sku}`, false);

  let id = (vari) ? vari : mlb;

  let hasSellerSku = item.attributes.findIndex(elem => elem.id === "SELLER_SKU");
  if (hasSellerSku < 0) {
    // Do nothing if not found, we will add it
  } else {
    // Remove existing SELLER_SKU
    item.attributes.splice(hasSellerSku, 1);
  }

  item.attributes.push({
    id: "SELLER_SKU",
    value_name: sku
  })

  let url = `items/${mlb}` + ((vari) ? `/variations/${vari}` : '');

  let reqData = { attributes: item.attributes };
  if (vari)
    reqData.id = id;

  const response = request(url, 'PUT', reqData);
  let apiResponse = await response;

  return _handleChangeResponse(mlb, vari, sku, item, apiResponse);
}

function _handleChangeResponse(mlb, vari, sku, item, apiResponse) {
  let oldLength, newLength, newsku, tag;
  try {
    if (!apiResponse)
      throw { message: "Invalid response data.", object: apiResponse, tag: 'fail-sanity' };

    if (vari) {
      apiResponse = apiResponse[apiResponse.findIndex(elem => elem.id && elem.id.toString() === vari)];
      if (!apiResponse)
        throw { message: "Failed to find variation in response!", apiResponse, tag: 'fail-nosuchvari' };
    }

    if (apiResponse.warnings)
      throw { fatal: false, message: 'There were warnings on the answer.', object: apiResponse, tag: 'warnings' };

    newLength = apiResponse.attributes.length;
    newsku = getSkuFromItem(apiResponse);
    if (newsku !== sku)
      throw { message: "SKU wasn't set correctly\n", object: apiResponse, tag: 'fail-skunotset' };

    console.log(`${getNotation(mlb, vari)} SKU is now ${sku}`, false, false);
    oldLength = item.attributes.length;
    tag = `new-${oldLength}-${newLength}`;
  } catch (e) {
    if (e.fatal !== false)
      return onErr(e.message, e.object, e.tag);
    onErr(e.message, e.object, e.tag);
  } finally {
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

function createBackup(mlb, item, ...tags) {
  let backup_path = path.resolve(BACKUP_PATH);

  if (!fs.existsSync(backup_path)) {
    try {
      fs.mkdirSync(backup_path, { recursive: true });
    } catch (e) {
      return onErr("Error creating backups folder", e);
    }
  }

  let backup_file = path.join(backup_path, `${mlb} (${tags.join('-')} @ ${((new Date).valueOf())}).json`);

  try {
    fs.writeFileSync(path.resolve(backup_file), JSON.stringify(item, null, 2));
  } catch (err) {
    console.error(err);
  }
}
