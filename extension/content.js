const extensionApi = globalThis.browser || globalThis.chrome;
let operationInProgress = false;
extensionApi.runtime.onMessage.addListener((message,sender,sendResponse) => {
  if (!['capture','stage'].includes(message.kind)) return false;
  if (operationInProgress) {sendResponse({error:'Another filter operation is running in this tab.'});return false;}
  operationInProgress = true;
  (message.kind === 'capture' ? LESite.capture() : LESite.stage(message.xml,message.filename))
    .then(result => sendResponse({result})).catch(error => sendResponse({error:error.message})).finally(() => {operationInProgress=false;});
  return true;
});
