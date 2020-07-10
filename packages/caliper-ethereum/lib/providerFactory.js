/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

// actual web3 websocket provider - connects us to the real blockchain
const WebsocketProvider = require('web3').providers.WebsocketProvider;

// JSON-RPC middleware - intercepts some RPC calls and responds with things we
// know already
const createBlockCacheMiddleware = require('eth-json-rpc-middleware/block-cache');
const createSubscriptionMiddleware = require('eth-json-rpc-filters/subscriptionManager');

// Block tracker - keeps the middleware up to date on the current block head
const SubscriptionBlockTracker = require('eth-block-tracker/dist/SubscribeBlockTracker');

// RPC Engine - ties together the middleware
const RpcEngine = require('json-rpc-engine');

// helper utilities to glue it all together
const providerAsMiddleware = require('eth-json-rpc-middleware/providerAsMiddleware');
const providerFromEngine = require('eth-json-rpc-middleware/providerFromEngine');

/**
 * Constructs an instance of Provider that is compatible with web3.js This
 * provider offers some special functionality that makes web3 a lot more
 * efficient under heavy load. This includes features like local management of
 * `newHeads` subscriptions, caching of block headers, and other various
 * things. Use of this provider will reduce RPC requests sent by caliper to the
 * client by at least 50% during transaction benchmarking runs.
 *
 * @param {string} url The url for the client's RPC endpoint (must be a websocket URL)
 * @return {Provider} The initialized provider instance.
 */
function providerFactory(url) {
    const provider = new WebsocketProvider(url);

    // some json-rpc-engine components expect the old `sendAsync` provider
    // function.
    if (!provider.sendAsync) {
        provider.sendAsync = provider.send;
    }

    const blockTracker = new SubscriptionBlockTracker({ provider });

    const blockCacheMiddleware = createBlockCacheMiddleware({ blockTracker });
    const subscriptionMiddleware = createSubscriptionMiddleware({ blockTracker, provider });
    const providerMiddleware = providerAsMiddleware(provider);

    const rpcEngine = new RpcEngine();

    // middleware are pushed onto a stack, so the middleware pushed earliest is
    // called last.
    rpcEngine.push(providerMiddleware);
    rpcEngine.push(blockCacheMiddleware);
    rpcEngine.push(subscriptionMiddleware);

    return providerFromEngine(rpcEngine);
}


exports = module.exports = providerFactory;
