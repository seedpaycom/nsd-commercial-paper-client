/**
 * Created by maksim on 8/16/17.
 */

const log4js  = require('log4js');
const logger  = log4js.getLogger('FabricRestClient');
const request = require('request');

module.exports = FabricRestClient;


const INSTRUCTION_CC = 'instruction';
const INSTRUCTION_SIGN_METHOD = 'sign';


/**
 * @param {string} endpoint - url of fabric rest api
 * @constructor
 */
function FabricRestClient(endpoint){
  this._ep = endpoint;
  this._token = null;
}




/**
 * @param {string} channelID
 * @param {string} contractID
 * @param {Array<string>} endorsers - peersId (orgPeerID)
 * @param {string} fcn
 * @param {Array} [args]
 */
FabricRestClient.prototype.sendSignature = function(channelID, endorsers, instruction, signature){
  var args = FabricRestClient.instructionArguments(instruction);
  args.push(signature);
  return this.invoke(channelID, INSTRUCTION_CC, endorsers, INSTRUCTION_SIGN_METHOD, args);
}


/**
 * return basic fields for any instruction request
 * @static
 * @return {Array<string>}
 */
FabricRestClient.instructionArguments = function(instruction) {
  var args = [
    instruction.deponentFrom,        // 0: deponentFrom
    instruction.transferer.account,  // 1: accountFrom
    instruction.transferer.division, // 2: divisionFrom

    instruction.deponentTo,          // 3: deponentTo
    instruction.receiver.account,    // 4: accountTo
    instruction.receiver.division,   // 5: divisionTo

    instruction.security,            // 6: security
    ''+instruction.quantity,         // 7: quantity
    instruction.reference,           // 8: reference
    instruction.instructionDate,     // 9: instructionDate
    instruction.tradeDate,           // 10: tradeDate
  ];

  return args;
}



/**
 * @param {string} username
 * @return {Promise<TokenInfo>}
 * @more curl -X POST http://localhost:4000/users -H "content-type: application/x-www-form-urlencoded" -d 'username=Jim'
 */
FabricRestClient.prototype.getConfig = function() {
  logger.debug('FabricRestClient.getConfig');
  return this._requestPromise({
      url : this._ep+'/config',
      method : "GET"
  });
};


/**
 * @param {string} username
 * @return {Promise<TokenInfo>}
 * @more curl -X POST http://localhost:4000/users -H "content-type: application/x-www-form-urlencoded" -d 'username=Jim'
 */
FabricRestClient.prototype.signUp = function(username) {
  logger.debug('FabricRestClient.signUp username - %s', username);

  var payload = {
    username:username
  };
  return this._requestPromise({
      url : this._ep+'/users',
      method : "POST",
      body   : payload,
      json   : true
  }).then(body=>{
    this._token = body.token;
    return body;
  })
};

/**
 *
 */
FabricRestClient.prototype.signOut = function() {
  logger.debug('FabricRestClient.signOut');
  this._token = null;
};



/**
 * @param {string} channelID
 * @param {string} contractID
 * @param {Array<string>} peers - peersId
 * @param {string} fcn
 * @param {Array} [args]
 */
FabricRestClient.prototype.invoke = function(channelID, contractID, peers, fcn, args){
  logger.debug('FabricRestClient.invoke channel - %s, contract - %s', channelID, contractID, JSON.stringify(peers), fcn, JSON.stringify(args) );
  args = args || [];
  var payload = {
    peers : peers,
    fcn   : fcn,
    args  : args||[]
  };
  return this._requestPromise({
      url: this._ep+'/channels/'+channelID+'/chaincodes/'+contractID,
      method: "POST",
      body   : payload,
      json   : true,
      headers:{
        'Authorization': this._token? 'Bearer '+this._token : null
      }
  });
};



/**
 * @param {string} channelID
 * @param {string} contractID
 * @param {string} peer - peerId
 * @param {string} fcn
 * @param {Array} [args]
 */
FabricRestClient.prototype.query = function(channelID, contractID, peer, fcn, args){
  logger.debug('FabricRestClient.query channel - %s, contract - %s', channelID, contractID, peer, fcn, JSON.stringify(args));
  args = args || [];
  var params = {
    peer : peer,
    fcn  : fcn,
    args : JSON.stringify(args||null)
  };

  return this._requestPromise({
    url: this._ep+'/channels/'+channelID+'/chaincodes/'+contractID,
    method: "GET",
    qs: params,
    headers:{
      'Authorization': this._token? 'Bearer '+this._token : null
    }
  });
};



/**
 *
 */
FabricRestClient.prototype._requestPromise = function(options){
  var self = this;
  return new Promise(function(resolve, reject){
    request(options, function(err, httpResponse, body){
      if (err) {
        return reject(err);
      } else {
        self._processResponse(httpResponse);
        return resolve(httpResponse);
      }
    });
  })
  .then(function(response){ return response.body; })
  .then(function(body){
    if( body.ok === false ){
      logger.warn('Request error:', body.message || body, '\n', options);
      throw new Error(body.message || body);
    }
    return body;
  });
};

/**
 *
 */
FabricRestClient.prototype._processResponse = function(httpResponse){
  // console.log(httpResponse.headers);
  if( (httpResponse.headers['content-type']||"").indexOf('application/json')>=0  && typeof httpResponse.body == "string" ){
    try{
      httpResponse.body = JSON.parse(httpResponse.body);
    }catch(e){
      logger.info('Cannot parse json response:', e, httpResponse.body);
    }
  }
}