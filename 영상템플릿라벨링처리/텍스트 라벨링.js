const mongoose = require('mongoose');
const Config = require('./config');
const xlsx = require('node-xlsx');
const moment = require('moment');

// Setup MongoDB
mongoose.Promise = global.Promise;
mongoose
  .connect(Config.DATABASE.ATLAS_URL, Config.DATABASE.OPTIONS)
  //   .connect(Config.DATABASE.LOCAL_URL, Config.DATABASE.OPTIONS)
  .then(async () => {
    console.log('DB CONNECTED SUCCESSED');
  })
  .catch((err) => console.log('DB CONNECTION FAILED : ' + err));

const Design = require('./models/design');

async function start() {
  const startTime = moment().format();
  // Parse a file
  const workSheetsFromFile = xlsx.parse(
    `${__dirname}/디자인 라벨링의 사본.xlsx`,
  );
  const errData = [];
  // console.log('workSheetsFromFile =', workSheetsFromFile);
  for (const sheet of workSheetsFromFile) {
    if (sheet.name === '240613_프로모션 추가_Paul') {
      if (
        sheet.name !== '템플릿 리스트' &&
        sheet.name !== '데이터 구조 예시' &&
        sheet.name !== '템플릿 리스트_9:16 확장'
      ) {
        // console.log('sheet.data.length =', sheet.data.length);
        let data = [];
        let insertType = 'product'; // promotion, product
        if (
          sheet.name === '제품소개_Jane(Paul 작업)' ||
          sheet.name === '제품소개_Paul_제품소개' ||
          sheet.name === '제품소개_Lily' ||
          sheet.name === '제품소개_Jade' ||
          sheet.name === '제품소개_Jane'
        ) {
          for (let i = 0; i < sheet.data.length; i++) {
            if (i > 15) {
              // console.log('sheet.data[i] =', sheet.data[i]);
              data.push(sheet.data[i]);
              // break;
            }
          }
        } else if (
          sheet.name === '제품소개_Paul_프로모션' ||
          sheet.name === '240613_프로모션 추가_Sol' ||
          sheet.name === '240613_프로모션 추가_Jade' ||
          sheet.name === '240613_프로모션 추가_Lily' ||
          sheet.name === '240613_프로모션 추가_Paul'
        ) {
          insertType = 'promotion';
          for (let i = 0; i < sheet.data.length; i++) {
            if (i > 21) {
              // console.log('sheet.data[i] =', sheet.data[i]);
              data.push(sheet.data[i]);
              // break;
            }
          }
        } else if (sheet.name === '제품소개_Sol') {
          for (let i = 0; i < sheet.data.length; i++) {
            if (i > 16) {
              // console.log('sheet.data[i] =', sheet.data[i]);
              data.push(sheet.data[i]);
              // break;
            }
          }
        }
        // console.log('data[0] =', data[0]);

        let temTitle;
        let temRatio;
        let highlight;
        let cont = 1;
        for (const dataItem of data) {
          // console.log('dataItem =', dataItem);
          if (dataItem[0]) {
            temTitle = dataItem[0];
            cont = 1;
            temRatio = '';
          }
          if (dataItem[1]) {
            temRatio = dataItem[1];
          }
          if (dataItem[2]) highlight = dataItem[2];
          // console.log('temTitle =', temTitle);

          const query = {
            $and: [
              { temTitle: temTitle },
              { languageCode: { $in: ['ko', 'en'] } },
              { group: 'vplate' },
            ],
          };

          if (temRatio && temRatio !== '') {
            console.log('temRatio =', temRatio);
            const tempArr = temRatio.split(',');
            console.log('tempArr =', tempArr);
            query.$and.push({ $or: [] });
            for (const item of tempArr) {
              query.$and[3].$or.push({
                templateRatio: Number(item),
              });
            }
          }
          console.log('query =', query);

          const design = await Design.find(query);
          // console.log('design =', design);
          for (const designItem of design) {
            const result = await Design.findOne({ _id: designItem._id });
            if (highlight === 'O') {
              result.highlight = 1;
            } else {
              result.highlight = 0;
            }
            if (
              (result.languageCode === 'en' || result.languageCode === 'ko') &&
              result.group !== 'skb'
            ) {
              for (let i = 0; i < 23; i++) {
                if (dataItem[i + 3]) {
                  console.log(' ');
                  console.log('sheet.name =', sheet.name);
                  console.log('temRatio =', temRatio);
                  console.log('query =', query);
                  console.log('i =', i);
                  console.log('_id =', result._id);
                  console.log('temTitle =', temTitle);
                  console.log('dataItem[' + (i + 3) + '] =', dataItem[i + 3]);
                  console.log('cont =', cont);
                  console.log(
                    'designItem.templateRatio =',
                    designItem.templateRatio,
                  );

                  const targetNum = await indexSearch(
                    designItem.sources[i].source,
                    cont,
                  );
                  console.log('targetNum =', targetNum);

                  const sourceTextTypeNum = await checkStringForKeywords01(
                    dataItem[i + 3],
                    insertType,
                  );
                  console.log('sourceTextTypeNum =', sourceTextTypeNum);

                  result.sources[i].source[targetNum].sourceTextType[
                    insertType
                  ] = sourceTextTypeNum;

                  if (
                    sourceTextTypeNum !== 1400 &&
                    sourceTextTypeNum !== 2400
                  ) {
                    const sourceTextNumber = await checkStringForKeywords03(
                      dataItem[i + 3],
                    );
                    console.log('sourceTextNumber =', sourceTextNumber);
                    result.sources[i].source[targetNum].sourceTextNumber[
                      insertType
                    ] = sourceTextNumber;
                  } else {
                    result.sources[i].source[targetNum].sourceTextNumber[
                      insertType
                    ] = 0;
                  }

                  if (
                    sourceTextTypeNum === 1400 ||
                    sourceTextTypeNum === 2400
                  ) {
                    const tempStr = dataItem[i + 3].replace(/^\^/g, '');
                    // console.log('tempStr =', tempStr);
                    result.sources[i].source[targetNum].sourceTextConstant[
                      insertType
                    ] = tempStr;
                  }
                }
              }
            }
            await result.save();
          }
          cont++;
        }
      }
    }
  }

  const endTime = moment().format();
  console.log('startTime =', startTime);
  console.log('endTime =', endTime);
  console.log('errData =', errData);
}

async function indexSearch(arr, searchIndex) {
  // console.log('indexSearch() > arr =', arr);
  let resultNum;
  let matchCnt = 0;
  for (let i = 0; i < arr.length; i++) {
    // console.log('arr[i].sourceType =', arr[i].sourceType);
    if (arr[i].sourceType === 'T') matchCnt++;
    if (matchCnt === searchIndex) {
      resultNum = i;
      break;
    }
  }
  return resultNum;
}

async function checkStringForKeywords01(inputString, insertType) {
  const productKeywords = {
    제품명: 1100,
    '제품 가격': 1200,
    '제품 특징': 1300,
    '^': 1400,
    'CTA 문구': 1500,
    캐치프레이즈: 1600,

    '제품 특징 a': 1310,
    '제품 특징 a 설명 short': 1311,
    '제품 특징 a 설명 medium': 1312,
    '제품 특징 b': 1320,
    '제품 특징 b 설명 short': 1321,
    '제품 특징 b 설명 medium': 1322,
    '제품 특징 c': 1330,
    '제품 특징 c 설명 short': 1331,
    '제품 특징 c 설명 medium': 1332,
    '제품 특징 d': 1340,
    '제품 특징 d 설명 short': 1341,
    '제품 특징 d 설명 medium': 1342,
    '제품 특징 e': 1350,
    '제품 특징 e 설명 short': 1351,
    '제품 특징 e 설명 medium': 1352,

    '캐치프레이즈 질문형 short': 1610,
    '캐치프레이즈 질문형 medium': 1611,
    '캐치프레이즈 일반형 short': 1620,
    '캐치프레이즈 일반형 medium': 1621,
  };
  const promotionKeywords = {
    제품명: 2100,
    '제품 가격': 2200,
    '제품 특징': 2300,
    '^': 2400,
    'CTA 문구': 2500,
    '프로모션 캐치프레이즈': 2600,
    '프로모션 내용': 2700,
    '할인 금액': 2800,
    할인율: 2900,

    '제품 특징': 2310,
    '제품 특징 설명 short': 2311,
    '제품 특징 설명 medium': 2312,
  };

  let foundKeywords = 0;
  if (insertType === 'product') {
    for (const keyword in productKeywords) {
      if (inputString.includes(keyword)) {
        foundKeywords = productKeywords[keyword];
      }
    }
  } else {
    for (const keyword in promotionKeywords) {
      if (inputString.includes(keyword)) {
        foundKeywords = promotionKeywords[keyword];
      }
    }
  }

  return foundKeywords;
}

async function checkStringForKeywords03(inputString) {
  const match = inputString.match(/\d+$/); // 문자열 뒤에 있는 숫자를 추출
  return match ? parseInt(match[0], 10) : 0;
}

start();
