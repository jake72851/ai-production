const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const Config = require('./config');

const autoStarterV3 = require('./utils/autoStarter_v3');

// Setup MongoDB
mongoose.Promise = global.Promise;
mongoose
  .connect(Config.DATABASE.ATLAS_URL, Config.DATABASE.OPTIONS)
  // .connect(Config.DATABASE.LOCAL_URL, Config.DATABASE.OPTIONS)
  .then(async () => {
    console.log('DB CONNECTED SUCCESSED');
  })
  .catch((err) => console.log('DB CONNECTION FAILED : ' + err));

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// db watch
autoStarterV3.process();

app.get('/', (req, res) => {
  return res.end();
});

const server = app.listen(Config.PORT, () => {
  console.log(`Server on ${Config.PORT}`);
});
server.timeout = 180000;
