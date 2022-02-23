/**
 * API Implementation
**/
const fetch = require('node-fetch');

let setAccessToken, getAccessToken, getAppKeys;

module.exports = {

  setup(accessTokenGetter, accessTokenSetter, appKeysGetter) {
    return new Promise (resolve => {
      getAccessToken = accessTokenGetter;
      setAccessToken = accessTokenSetter;
      getAppKeys = appKeysGetter;

      hostname = 'localhost';
      port = 63771;
      server_url = `http://${hostname}:${port}/`
      auth_resource = `code`;
      auth_url = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${getAppKeys().app_id}&redirect_uri=${server_url}${auth_resource}`
      module.exports.server_url = server_url;
      module.exports.auth_resource = auth_resource;
      module.exports.port = port;
      module.exports.auth_url = auth_url; //Yeah ugly af
      resolve();
    })
  },

  async fetchAccessToken(auth) {
    const appkeys = getAppKeys();

    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
  	'accept': 'application/json',
  	'content-type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=authorization_code
      &client_id=${appkeys.app_id}
      &client_secret=${appkeys.secret}
      &code=${auth}
      &redirect_uri=${server_url}${auth_resource}`
    });
    const data = await response.json();

    console.log(`Access Token: ${data.access_token}`, true);
    setAccessToken(data.access_token, data);
  },


  // .changeSku MLB2181674098 174214094869 SUCCESSSKU
  async changeSku(mlb, vari, sku, silent) {
    const access_token = getAccessToken();
    console.log(`Changing SKU for ${mlb}${vari?'/'+vari:''} to ${sku}`);
    const response = await fetch(`https://api.mercadolibre.com/items/${mlb}`, {
      method: 'PUT',
      headers: {
  	  'Authorization': `Bearer ${access_token}`,
  	  'Content-Type': 'application/json'
      },
      body: JSON.stringify({
  	variations: [{
  	    id: vari,
  	    seller_custom_field: sku
  	}]
      })
    })
    const data = await response.json();

    if (data.warnings || !silent) console.log(`Server Answer: ${JSON.stringify(data, null, 2)}`, true);
  },

  async getMe() {
    const access_token = getAccessToken();
    const response = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
  	  'Authorization': `Bearer ${access_token}`,
  	  'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    console.log(`Me: ${JSON.stringify(data, null, 2)}`, true);
  },

  async getItem(mlb, skuonly) {
    const access_token = getAccessToken();
    const response = await fetch(`https://api.mercadolibre.com/items/${mlb}${skuonly?'?attributes=id,seller_sku,seller_custom_field,variations.seller_custom_field':''}`, {
      headers: {
  	  'Authorization': `Bearer ${access_token}`,
  	  'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    console.log(`Me: ${JSON.stringify(data, null, 2)}`, true);
  },

  async createTestUser() {
    const access_token = getAccessToken();
    console.log(`Creating a Test User`);
    const response = await fetch('https://api.mercadolibre.com/users/test_user', {
      method: 'POST',
      headers: {
  	  'Authorization': `Bearer ${access_token}`,
  	  'Content-Type': 'application/json'
      },
      body: JSON.stringify({"site_id":"MLB"})
    });
    const data = await response.json();
    const resp = JSON.stringify(data, null, 2);
    if (!data.status) {
      console.log(`Test User: ${resp}`, true);
      if (session.testUsers) 
  	     session.testUsers.push(data); 
      else
      	 session.testUsers = [data];
      saveSession(); 
    } else {
      console.log(`Error: ${resp}`, true);
    }
  }
}