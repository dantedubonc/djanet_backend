require('dotenv').config()
const app = require("express")();
const bodyParser = require("body-parser");
const request = require("request");
const cors = require("cors");
const nodemailer = require("nodemailer");
const emailConf = require("./emailConf");

app.use(cors());
app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.send("Working");
});

app.post("/", function (req, res) {

  if (!req.body.recaptchaToken) {
      return res.status(400).json({message: "recaptchaToken is required"});
  }
 
  const verifyCaptchaOptions = {
      uri: "https://www.google.com/recaptcha/api/siteverify",
      json: true,
      form: {
          secret: process.env.CAPTCHA_SECRET,
          response: req.body.recaptchaToken
      }
  };

 

  request.post(verifyCaptchaOptions, async function (err, response, body) {
          if (err) {
              return res.status(500).json({message: "oops, something went wrong on our side"});
          }
       
          if (!body.success) {
              return res.status(500).json({message: body["error-codes"].join(".")});
          }

          const formData = req.body;

          const conf = emailConf[formData.Locale]

          const transporter = nodemailer.createTransport({
            host: conf.Host,
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
              user: conf.Username, // generated ethereal user
              pass: conf.Password // generated ethereal password
            }
          });

          try {
            const info = await transporter.sendMail({
              from: `${conf.SenderName} <${conf.From}>`, // sender address
              to: formData.Email, // list of receivers
              bcc: conf.BCC,
              subject: conf.Subject, // Subject line
              text: conf.Message, // plain text body
              html: conf.Message // html body
            });
            console.log("Message sent: %s", info.messageId);
            
          } catch (error) {
            res.status(401).json({message: JSON.stringify(error)})
          }
      
          res.status(201).json({message: "Congratulations! We think you are human."});
      }
  );


});

app.listen(3001, function () {
  console.log('Listening on port 3001!');
});
