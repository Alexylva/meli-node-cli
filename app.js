/** 
 * Configurations
**/
const app_id = process.env.APP_ID;
const secret = process.env.SECRET;

const session_file = {dir:"./data/", file: "session.json", path() { return this.dir + this.file } } ;
/** 
 * Imports
**/

const utils = require("./utils")




