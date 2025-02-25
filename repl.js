/** 
 * REPL
**/
const DEFAULT_PROMPT = 'meli-cli > ';

let oldlog = console.log;
let reviveFunction = () => { };

// Console.log override for log formatting
console.log =
  (logdata, revive = false, newline = true) => {
    oldlog(`${newline ? '\n' : ''}[${new Date().toLocaleString()}] ${logdata}`);
    if (revive) reviveFunction();
  };

/**
 * REPL Server to allow for interactive command interface.
 */
let repl = {
  setup(sessionApi, mlApi) {
    const repl = require("repl");

    oldlog(LICENSE);

    const r = repl.start({ prompt: DEFAULT_PROMPT });
    setPromptProfile(r, sessionApi.getProfile());
    reviveFunction = r._refreshLine;

    r.defineCommand('license', () => {
      console.log(EXTENDED_LICENSE);
    });

    r.defineCommand('newAccessToken', () => {
      sessionApi.newAccessToken();
    });

    r.defineCommand('accessToken', {
      help: 'Show accessToken',
      action() {
        sessionApi.getAccessToken().then(log);
      }
    });

    r.defineCommand('setAccessToken', {
      help: 'Manually updates ML\'s access token',
      action(token) {
        sessionApi.setAccessToken(token);
        console.log("Access Token updated.", true, false)
      }
    });

    r.defineCommand('item', {
      help: 'Gets item info',
      action(param) {
        if (!sessionApi.hasAccessToken()) return onErr('Missing or Invalid Access Token.');
        let params = param.split(" ", 2);
        mlApi.getItem(...params).then(log);
      }
    });

    r.defineCommand('profile', (profile) => {
      sessionApi.setProfile(profile);
      setPromptProfile(r, profile);
      console.log(`Defined current profile as ${profile}`, true, false);
    });

    r.defineCommand('getProfile', () =>
      console.log(`Current slot: ${sessionApi.getProfile()}`, true, false)
    );

    r.defineCommand('changeSku', {
      help: 'Manually changes a ad\'s SKU',
      action(param) {
        if (!sessionApi.hasAccessToken()) return onErr('Missing or Invalid Access Token.');
        let params = param.split(" ", 3);
        let mlb, vari, sku;
        if (params.length < 2 || params.length > 3) 
          throw onErr("Invalid parameters");
        if (params.length === 2) 
          [mlb, undefined, sku] = params;
        else (params.length === 3)
          [mlb, vari, sku] = params;
        mlApi.changeSku(...params);
      }
    });

    r.defineCommand('batchChangeSku', {
      help: "Takes a csv file as parameter (columns being MLB, Vari (null for non-variation MLBs), SKU) and updates all skus.",
      action(filename) {
        mlApi.batchChangeSku(filename);
      }
    
    })

    r.defineCommand('getAllAds', {
      help: "Exports a list of MLBs, variation IDs and assigned SKUs",
      action() {
        // Passes profile name for output filename
        mlApi.getAllAds(sessionApi.getProfile()); 
      }
    })

    r.defineCommand('createTestUser', {
      help: 'Creates a testing purpose user.',
      action() {
        if (!sessionApi.hasAccessToken()) return onErr('Missing or Invalid Access Token.');
        mlApi.createTestUser().then((testUser) => {
          if (!testUser) return onErr('Failed creating test user.')
          console.log(JSON.stringify(testUser));
          //sessionApi.addTestUser(testUser);
        })
      }
    })

    r.defineCommand('testUsers', {
      help: 'Show stored test users',
      action() {
        if (sessionApi.hasTestUsers()) {
          console.log(JSON.stringify(sessionApi.getTestUsers(), null, 2), false, false);
          console.log('More info on https://developers.mercadolivre.com.br/pt_br/realizacao-de-testes', true);
        }
      }
    })

    r.defineCommand('me', {
      help: "Gets account personal info, acts as a access benchmark",
      action() {
        if (!sessionApi.hasAccessToken()) return onErr('Missing or Invalid Access Token.');
        mlApi.getMe().then(log);
      }
    })

    r.defineCommand('getPrices', {
      help: 'Fetch prices for a specific item by its MLB ID',
      action(mlb) {
        if (!sessionApi.hasAccessToken()) return console.error('Missing or Invalid Access Token.');
        if (!mlApi.isMLBValid(mlb)) return console.error('Invalid MLB ID format. Example: MLB123456789');
    
        console.log(`Fetching prices for item ${mlb}...`);
        mlApi.getItemPrices(mlb).then((prices) => {
          console.log(JSON.stringify(prices, null, 2));
        }).catch((err) => {
          console.error('Error fetching prices:', err);
        });
      }
    });
    
    r.defineCommand('getAllPrices', {
      help: 'Exports all product prices for the account to a CSV file',
      action(filenamePrefix = 'prices') {
        if (!sessionApi.hasAccessToken()) return console.error('Missing or Invalid Access Token.');
    
        console.log('Exporting all product prices to a CSV file...');
        mlApi.getAllPrices(filenamePrefix).then(() => {
          console.log('Price export completed successfully.');
        }).catch((err) => {
          console.error('Error exporting prices:', err);
        });
      }
    });    

    r.on('exit', () => {
      console.log('Quitting');
      process.exit();
    });
    return repl;
  }
}

function setPromptProfile(repl, profile) {
  repl.setPrompt(`${profile}@${DEFAULT_PROMPT}`);
  repl.displayPrompt();
}

/** 
 * Auxiliary
 */

 function onErr(e) {
   console.log(e, true, false);
   return undefined;
}

function log(data) {
    console.log(JSON.stringify(data, null, 2), true, false);
}

module.exports = repl;

const LICENSE = `
Copyright (C) 2022  Alexylva
This program comes with ABSOLUTELY NO WARRANTY; for details type ".license".
This is free software, and you are welcome to redistribute it
under certain conditions.\n`

const EXTENDED_LICENSE = `
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
`