require("dotenv").config();

require("es6-promise").polyfill();
require("isomorphic-fetch");
var Koa = require("koa");
var Router = require("koa-router");
const cors = require("@koa/cors");
var bodyParser = require("koa-bodyparser");
const nodemailer = require("nodemailer");
const emailConf = require("./emailConf");
const respond = require("koa-respond");
const fetch = require("node-fetch");
const ejs = require("ejs");

var app = new Koa();
app.use(cors());
app.use(bodyParser());
app.use(respond());
var router = new Router();

const handleErrors = async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    console.log(e);
    ctx.badRequest(e.message);
  }
};

const getCaptcha = async (ctx, next) => {
  const body = ctx.request.body;
  if (!body.recaptchaToken) {
    throw new Error("recaptchaToken is required");
  }

  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.CAPTCHA_SECRET}&response=${body.recaptchaToken}`;

  const res = await fetch(url, {
    method: "post",
  });
  ctx.state.data = await res.json();

  await next();
};

const validateCaptcha = async (ctx, next) => {
  const captchaResponse = ctx.state.data;

  if (!captchaResponse.success) {
    throw new Error(captchaResponse["error-codes"]);
  }

  await next();
};

const sendEmail = async (ctx, next) => {
  const formData = ctx.request.body;

  const conf = emailConf[formData.Locale];
  const transporter = nodemailer.createTransport({
    host: conf.Host,
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: conf.Username, // generated ethereal user
      pass: conf.Password, // generated ethereal password
    },
  });

  const html = await ejs.renderFile(__dirname + "/emails/djanet.ejs", {
    name: formData.Name,
    company: formData.Enterprise,
    lastName: formData.Surname,
    city: formData.City,
    phone: formData.Phone,
    message: formData.Question,
    country: formData.Country,
    email: formData.Email
  }, {async: true});

  const info = await transporter.sendMail({
    from: `${conf.SenderName} <${conf.From}>`, // sender address
    to: formData.Email, // list of receivers
    bcc: conf.BCC,
    subject: conf.Subject, // Subject line
    text: conf.Message, // plain text body
    html: html, // html body
  });
  ctx.state.data = info.messageId;

  next();
};

const sendData = (ctx) => {
  ctx.status = 200;
  ctx.body = ctx.state.data;
};

router.get("/", (ctx, next) => {
  // ctx.router available
  ctx.body = "Hello World";
});

router.post(
  "/",
  handleErrors,
  getCaptcha,
  validateCaptcha,
 
  sendEmail,
  sendData
);

app.use(router.routes()).use(router.allowedMethods());

app.listen(3001);
