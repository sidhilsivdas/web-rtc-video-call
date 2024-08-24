const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 8000 },()=>{
    console.log('server started')
})
wss.on('connection', (ws) => {
   ws.on('message', (data) => {
    //data=JSON.parse(data);
      console.log('data received \n '+ data)
      const dataFromClient = JSON.parse(data.toString());
  const json = dataFromClient;
  //console.log('data made \n '+ json);
  const res_data = JSON.stringify(json);
      //js_data = JSON.stringify(data);
      wss.clients.forEach(function(client) {
         console.log("here", res_data);
         if (client.readyState === WebSocket.OPEN) {
          console.log("client readystate server");
          if(client !== ws){
            client.send(res_data);
          }
             
        }
         //client.send(res_data);
      });
   })
})
wss.on('listening',()=>{
   console.log('listening on 8000')
})