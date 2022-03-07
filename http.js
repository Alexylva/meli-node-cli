/** 
 * Server Configurations
**/

let auth_url;

function setup(accessTokenFetcher, sessionApi, appKeysGetter) {
  return new Promise(resolve => {
    const express = require("express");
    const http = express();

    const [fetchAccessToken, getAppKeys] = [accessTokenFetcher, appKeysGetter];

    const hostname = 'localhost';
    const port = 63771; //🤔 Perhaps choose port at random?
    const server_url = `http://${hostname}:${port}/`
    const auth_resource = `code`;
    const redirect_uri = `${server_url}${auth_resource}`;
    auth_url = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${getAppKeys().app_id}&redirect_uri=${redirect_uri}`;

    http.use(express.json());
    http.use(express.urlencoded({ extended: true }));

    http.get(`/${auth_resource}`, (req, res) => {
      let auth = req.query.code;
      if (!auth) return onErr("Failed retrieving Auth Code", auth);
      console.log(`Auth Code: ${auth} for slot "${sessionApi.getProfile()}"`, true);
      sessionApi.setAuth(auth);
      res.send("<script>window.close()</script>");

      let response = fetchAccessToken(auth, redirect_uri).then((response)=>{;
        console.log(response);
        console.log(`Access Token: ${response.access_token}`, true);
        sessionApi.setAccessToken(response.access_token, response)
      });
    });

    http.listen(port, () => {
      console.log(`Server running on ${server_url}`, true);
      sessionApi.verifyAccessToken(auth_url);
      resolve(http);
    });
  })
}

module.exports = {
  setup,
  auth_url
}