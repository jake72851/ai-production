const mongoose = require('mongoose');
const Config = require('./config');
const xlsx = require('node-xlsx');
const moment = require('moment');

// Setup MongoDB
mongoose.Promise = global.Promise;
mongoose
  .connect(Config.DATABASE.ATLAS_URL, Config.DATABASE.OPTIONS)
  // .connect(Config.DATABASE.LOCAL_URL, Config.DATABASE.OPTIONS)
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
  // console.log('workSheetsFromFile =', workSheetsFromFile);
  for (const sheet of workSheetsFromFile) {
    if (sheet.name === '240613_프로모션 추가_Paul') {
      if (
        sheet.name !== '템플릿 리스트' &&
        sheet.name !== '데이터 구조 예시' &&
        sheet.name !== '템플릿 리스트_9:16 확장'
      ) {
        console.log('sheet.data.length =', sheet.data.length);
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

        for (const dataItem of data) {
          if (dataItem[0]) {
            temTitle = dataItem[0];
          }
          console.log('temTitle =', temTitle);

          const design = await Design.find({ temTitle: temTitle });

          // 분절된 텍스트의 총합
          for (const designItem of design) {
            console.log('designItem._id =', designItem._id);
            let result = await Design.findOne({
              _id: designItem._id,
              group: 'vplate',
              languageCode: { $in: ['ko', 'en'] },
              group: { $ne: 'skb' },
            });

            if (result) {
              console.log('result._id =', result._id);
              console.log('result.temTitle =', result.temTitle);

              const tempDep1Arr = [];
              const tempDep2Arr = [];
              const tempContArr = [];
              const tempIdArr = [];

              let count = 0;
              let dep1LoopCount = 0;
              let dep2LoopCount = 0;

              let prevSourceTextType;

              let prevDep1LoopCount;
              let prevDep2LoopCount;

              if (result && result.sources) {
                for (let sources of result.sources) {
                  for (let item of sources.source) {
                    console.log(
                      'dep1 =',
                      dep1LoopCount,
                      '/ dep2 =',
                      dep2LoopCount,
                    );

                    if (
                      item.sourceType === 'T' &&
                      item.sourceTextNumber[insertType] > 0
                    ) {
                      console.log(
                        'item.sourceTextType[' + insertType + '] =',
                        item.sourceTextType[insertType],
                      );
                      console.log(
                        'item.sourceTextNumber[' + insertType + '] =',
                        item.sourceTextNumber[insertType],
                      );

                      if (
                        prevSourceTextType === item.sourceTextType[insertType]
                      ) {
                        if (item.sourceTextNumber[insertType] == 2) {
                          // console.log('2 인 경우');
                          tempDep1Arr.push(prevDep1LoopCount, dep1LoopCount);
                          tempDep2Arr.push(prevDep2LoopCount, dep2LoopCount);
                          tempContArr.push(count, count);
                          tempIdArr.push(
                            prevSourceTextType,
                            item.sourceTextType[insertType],
                          );
                        } else if (item.sourceTextNumber[insertType] > 2) {
                          // console.log('2 이상인 경우');
                          tempDep1Arr.push(dep1LoopCount);
                          tempDep2Arr.push(dep2LoopCount);
                          tempContArr.push(count);
                          tempIdArr.push(item.sourceTextType[insertType]);
                        }

                        count++;
                        for (
                          let i = tempContArr.length - 1;
                          i >= tempContArr.length - count;
                          i--
                        ) {
                          tempContArr[i] = count;
                        }
                      } else {
                        count = 1;
                        prevSourceTextType = item.sourceTextType[insertType];
                      }
                      prevDep2LoopCount = dep2LoopCount;
                      prevDep1LoopCount = dep1LoopCount;
                    }
                    dep2LoopCount++;
                  }
                  dep1LoopCount++;
                  dep2LoopCount = 0;
                }
                console.log('tempDep1Arr =', tempDep1Arr);
                console.log('tempDep2Arr =', tempDep2Arr);
                console.log('tempContArr =', tempContArr);
                console.log('tempIdArr =', tempIdArr);
                console.log(' ');
                console.log(' ');
                console.log(' ');
                console.log(' ');
                console.log(' ');
                console.log(' ');
                console.log(' ');
                for (let i = 0; i < tempDep1Arr.length; i++) {

                  result.sources[tempDep1Arr[i]].source[
                    tempDep2Arr[i]
                  ].sourceTextNumberTotal[insertType] = tempContArr[i];

                  console.log(
                    'result.sources[' +
                      tempDep1Arr[i] +
                      '].source[' +
                      tempDep2Arr[i] +
                      '].sourceTextNumberTotal = ',
                    result.sources[tempDep1Arr[i]].source[tempDep2Arr[i]]
                      .sourceTextNumberTotal,
                  );
                }
                await result.save();
              }
            }
          }
        }
      }
    }
  }

  const endTime = moment().format();
  console.log('startTime =', startTime);
  console.log('endTime =', endTime);
}

start();
