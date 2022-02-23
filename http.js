/** 
 * Server Configurations
**/

function setup(getAppKeys, sessionApi, accessTokenFetcher) {
  const hostname = 'localhost';
  const port = 63771;
  const server_url = `http://${hostname}:${port}/`
  const auth_resource = `code`;
  const auth_url = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${getAppKeys().app_id}&redirect_uri=${server_url}${auth_resource}`

  const express = require("express");
  const http = express();

  http.use(express.json());
  http.use(express.urlencoded({ extended: true }));

  http.get(`/${auth_resource}`, (req, res, next) => {
    let auth = req.query.code;
    if (!auth) return onErr("Fail retrieving Auth Code", auth);
    console.log(`Auth Code: ${auth} for slot "${slot}"`, true);
    sessionApi.setAuth(auth);
    res.send("<script>window.close()</script>");
    accessTokenFetcher(auth);
  });

  http.listen(port, () => {
    console.log(`Server running on port ${server_url}`, true);
    if (!sessionApi.hasAccessToken()) console.log(`Use this link to get the token ${auth_url}`);
  });


  return http;
}

module.exports = {
  setup
}