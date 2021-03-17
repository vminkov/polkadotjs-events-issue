import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { readFile } from "fs/promises";
import { CodePromise, Abi, ContractPromise } from '@polkadot/api-contract';


const testingContractWasmPath = '../target/ink/testing.contract';
const testingContractAbiPath = '../target/ink/metadata.json';
const testingContractWasm = await readFile(testingContractWasmPath).then(json => JSON.parse(json)).catch(() => null);
const testingContractAbi = await readFile(testingContractAbiPath).then(json => JSON.parse(json)).catch(() => null);

const subContractWasmPath = '../target/ink/sub/sub.contract';
const subContractAbiPath = '../target/ink/sub/metadata.json';
const subContractWasm = await readFile(subContractWasmPath).then(json => JSON.parse(json)).catch(() => null);
const subContractAbi = await readFile(subContractAbiPath).then(json => JSON.parse(json)).catch(() => null);

const wsProvider = new WsProvider('ws://127.0.0.1:9944');
const api = await ApiPromise.create({provider: wsProvider,});

let testingContract, subContract;

describe('testing', function() {
    it('events emitted from subcontract call should not result in errors', async function() {
        console.log(api.genesisHash.toHex());

        const keyring = new Keyring({type: 'sr25519', ss58Format: 42});
        const bob = keyring.addFromUri('//Bob', {name: 'Bob default'});
        const alice = keyring.addFromUri('//Alice', {name: 'Alice default'});

        console.log("deploying the sub contract...");
        subContract = await instantiateContract(subContractWasm.source.wasm, subContractAbi, bob, 8);

        console.log("deploying the testing contract...");
        testingContract = await instantiateContract(testingContractWasm.source.wasm, testingContractAbi, alice, subContract.address);


        await new Promise((resolve) => {
            testingContract.tx.callIncrement({gasLimit: -1, value: 0})
                .signAndSend(alice, ({status, events, contractEvents}) => {
                    if (status.isInBlock) {
                        // if contractEvents is undefined, refer to this bugfix
                        // https://github.com/polkadot-js/api/pull/3324#issue-593142079
                        console.log('contract events are ', contractEvents);
                        resolve();
                    }
                })
        })

        // make another call, so the error from the decoding of the events
        // in the previous is thrown
        await new Promise((resolve => {
            testingContract.query.get({}, bob.address)
                .then(({result, output}) => {
                    console.log('output ', output);
                    resolve();
                })
        }))
    }).timeout(20000);
});

async function instantiateContract(jsonWasm, jsonAbi, deployerKeys, ...constructorParams) {
    const code = new CodePromise(api, jsonAbi, jsonWasm);
    const tombstoneDeposit = await api.consts.contracts.tombstoneDeposit;

    let constructorExecutionGas = 13500000000;
    let value = parseInt(tombstoneDeposit) * 2.5;
    let unsub;

    let {codeHash, contractAddress} = await new Promise(resolve => {
        let codeHash, contractAddress;
        const salt = Array.from({length: 5}, () => Math.floor(Math.random() * 32));

        let params = {gasLimit: constructorExecutionGas, salt: salt, value: value};
        unsub = code.tx.new(params, ...constructorParams)
            .signAndSend(deployerKeys, ({ status, events }) => {
                if (status.isInBlock || status.isFinalized) {
                    events.forEach(({ event }) => {
                        if (api.events.system.ExtrinsicFailed.is(event)) {
                            let { data: [ error, info ] } = event;
                            if (error.isModule) {
                                // for module errors, we have the section indexed, lookup
                                const decoded = api.registry.findMetaError(error.asModule);
                                const {documentation, method, section} = decoded;

                                console.log(`${section}.${method}: ${documentation.join(' ')}`);
                            } else {
                                // Other, CannotLookup, BadOrigin, no extra info
                                console.log(error.toString());
                            }
                        } else if (api.events.contracts.CodeStored.is(event)) {
                            let { data: [code_hash] } = event;
                            codeHash = code_hash;
                        } else if (api.events.contracts.Instantiated.is(event)) {
                            let { data: [ deployer, contract ] } = event;
                            contractAddress = contract;
                        }
                    })
                    if (contractAddress) {
                        resolve({ codeHash, contractAddress });
                    }
                }
            })
    })

    const abi = new Abi(jsonAbi, api.registry);
    return new ContractPromise(api, abi, contractAddress);
}
