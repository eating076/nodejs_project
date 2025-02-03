var express = require("express")
var mysql = require("mysql")
var app = express()
app.use(express.json)

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'cindy789125',
    database: 'my_test_project'
  });

  connection.connect((err) => {
    if (err) {
      console.log(err)
    }
    else{
    console.log('on port 3000')}
  });

  app.post('/post',(req,res)=>{
    const name=req.body.name;
    const id=req.body.id;
    const mark=req.body.mark;

    connection.query('insert into mytable values(?,?,?)',[id,name,mark],(err,result)=>{
      if (err) {
        console.log(err)
      }
      else{
      res.send("POSTED")}
    });
  })

  app.listen(3000,(err)=>{

  })