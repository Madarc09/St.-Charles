const S=require('../lib/pool-store');
module.exports=async function(req,res){S.headers(res);try{if(req.method!=='GET')throw S.error('Use the current draft room.',405);const {state}=await S.read(S.roomName(req));return res.status(200).json({ok:true,presence:S.presence(state)});}catch(e){return S.sendError(res,e);}};
