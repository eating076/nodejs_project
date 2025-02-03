const http = require('http')
const fs = require('fs')
const dayjs = require('dayjs')

console.log(dayjs().year())
console.log(dayjs().hour())
console.log(dayjs().minute())
console.log(dayjs().second())

const server = http.createServer((req,res)=>{
  console.log('訪客請求已經收到')

  /*console.log(req.url)
  console.log(req.method)
  */
 let path = './page/'
 switch(req.url)
 {
  case '/':
    path += 'index.html'
    res.statusCode = 200
    break;
  case '/about':
    path += 'about.html'
    res.statusCode = 200
    break;
  case '/aboutme':
    res.statusCode = 301
    res.setHeader('Location','/about')
    res.end
    break;
  default:
    path += '404.html'
    res.statusCode = 404
    break;
 }
  res.setHeader('Content-Type','text/html')

  fs.readFile(path,(error,data)=>{

    if(error)
      console.log(error)
    
    else
      res.write(data)

      res.end()
    
    })

  
})

server.listen(3000,'localhost',()=>{
  console.log('伺服器已在聆聽第3000號port')
})
