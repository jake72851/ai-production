const OpenAI = require('openai');
const wait = require('waait');

const CONF = require('../config');

const User = require('../models/user');
const AiRequest = require('../models/aiRequest_v2');
const getKeywordWithScenario = require('./genKeyword_v3');

const openai = new OpenAI({
  apiKey: CONF.openai.API_KEY,
});

exports.process = async (aiRequestId, design) => {
  try {
    let resultTexts = [];

    const aiRequest = await AiRequest.findById(aiRequestId);
    let usedLang =
      !aiRequest.lang || !['en', 'ko', 'id'].includes(aiRequest.lang)
        ? 'en'
        : aiRequest.lang;

    let insertType = 'product'; // 카테고리 타입
    let constantType = 1400; // 카테고리의 상수 타입
    if (aiRequest.category === 101) {
      // 프로모션이면 변경
      insertType = 'promotion';
      constantType = 2400;
    }

    // 디자인에서 텍스트 처리한 부분 취합
    // 여기에선 텍스트만 처리하므로 scene 구분 없이 처리한다
    let additionalTextLen = 3; // 한글은 +3 처리
    if (usedLang != 'ko') additionalTextLen = 0;
    const textType = [];
    const textDiviNum = [];
    const textMaxChar = [];
    let tempTextMaxChar = [];
    for (const item of design.sources) {
      for (const sourceItem of item.source) {
        // 텍스트인 경우만. 상수 제외
        if (
          sourceItem.sourceType === 'T' &&
          sourceItem.sourceTextType[insertType] !== constantType
        ) {
          if (sourceItem.sourceTextNumber[insertType] === 0) {
            // 연속되지 않은 텍스트라면 그냥 추가
            textType.push(sourceItem.sourceTextType[insertType]);
            textDiviNum.push(1);
            textMaxChar.push([
              sourceItem.sourceTextLength[0] + additionalTextLen,
            ]);
          } else if (
            sourceItem.sourceTextNumber[insertType] <
            sourceItem.sourceTextNumberTotal[insertType]
          ) {
            // 연속된 텍스트에서 초기 텍스트정보라면 최대 텍스트갯수 정보만 추가
            tempTextMaxChar.push(
              sourceItem.sourceTextLength[0] + additionalTextLen,
            );
          } else if (
            sourceItem.sourceTextNumber[insertType] ===
            sourceItem.sourceTextNumberTotal[insertType]
          ) {
            // 연속된 텍스트라면 마지막 정보만 추가
            textType.push(sourceItem.sourceTextType[insertType]);
            textDiviNum.push(sourceItem.sourceTextNumberTotal[insertType]);
            tempTextMaxChar.push(
              sourceItem.sourceTextLength[0] + additionalTextLen,
            );
            textMaxChar.push([...tempTextMaxChar]);
            // 임시 최대 텍스트갯수 배열 초기화
            tempTextMaxChar = [];
          }
        }
      }
    }
    console.log('scenarioGen_v3.process() > textType =', textType);
    console.log(
      'scenarioGen_v3.process() > textType.length =',
      textType.length,
    );
    console.log('scenarioGen_v3.process() > textDiviNum =', textDiviNum);
    console.log(
      'scenarioGen_v3.process() > textDiviNum.length =',
      textDiviNum.length,
    );
    console.log('scenarioGen_v3.process() > textMaxChar =', textMaxChar);
    console.log(
      'scenarioGen_v3.process() > textMaxChar.length =',
      textMaxChar.length,
    );

    // 시나리오 처리
    const textTypes = {
      product: {
        1100: 'name', // 제품명
        1200: 'priceInfo.originalPrice', // 제품 가격
        1310: 'feature.0.feature', // 제품 특징 a
        1311: 'feature.0.short', // 제품 특징 a 설명 short
        1312: 'feature.0.detailed', // 제품 특징 a 설명 medium
        1320: 'feature.1.feature', // 제품 특징 b
        1321: 'feature.1.short', // 제품 특징 b 설명 short
        1322: 'feature.1.detailed', // 제품 특징 b 설명 medium
        1330: 'feature.2.feature', // 제품 특징 c
        1331: 'feature.2.short', // 제품 특징 c 설명 short
        1332: 'feature.2.detailed', // 제품 특징 c 설명 medium
        1340: 'feature.3.feature', // 제품 특징 d
        1341: 'feature.3.short', // 제품 특징 d 설명 short
        1342: 'feature.3.detailed', // 제품 특징 d 설명 medium
        1350: 'feature.4.feature', // 제품 특징 e
        1351: 'feature.4.short', // 제품 특징 e 설명 short
        1352: 'feature.4.detailed', // 제품 특징 e 설명 medium
        1361: 'feature.4.short', // 제품 특징 e 설명 short
        1352: 'feature.4.detailed', // 제품 특징 e 설명 medium
        1500: 'cta.cta', // CTA문구
        1610: 'hooking.short', // 캐치프레이즈 질문형 short
        1611: 'hooking.detailed', // 캐치프레이즈 질문형 medium
        1620: 'moving.short', // 캐치프레이즈 일반형 short
        1621: 'moving.detailed', // 캐치프레이즈 일반형 medium
      },
      promotion: {
        2100: 'name', // 제품명
        2200: 'priceInfo.originalPrice', // 제품 가격
        2310: 'feature.0.feature', // 제품 특징
        2311: 'feature.0.short', // 제품 특징 설명 short
        2312: 'feature.0.detailed', // 제품 특징 설명 medium
        2500: 'cta.cta', // CTA 문구
        2600: 'promotionTitle', // 프로모션 캐치프레이즈
        2700: 'promotionDetail', // 프로모션 내용
        2800: 'promotionPrice', // 할인금액
        2900: 'promotionPricePercent', // 할인율
      },
    };

    // const resultText = [];
    let saveNum = 0;
    const saveMarketingNum = aiRequest.feature.length - 1;
    console.log(
      'scenarioGen_v3.process() > saveMarketingNum =',
      saveMarketingNum,
    );
    for (let i = 0; i < textType.length; i++) {
      const tempStr = textTypes[insertType][textType[i]];
      console.log('scenarioGen_v3.process() > tempStr =', tempStr);
      const depth = tempStr.split('.');
      console.log('scenarioGen_v3.process() > depth =', depth);
      let tempTextType;
      if (depth.length === 1) {
        if (
          depth[0] === 'feature' ||
          depth[0] === 'hooking' ||
          depth[0] === 'moving' ||
          depth[0] === 'promotionTitle' ||
          depth[0] === 'promotionDetail'
        ) {
          tempTextType = aiRequest[depth[0]][saveMarketingNum];
        } else {
          tempTextType = aiRequest[depth[0]];
        }
      } else if (depth.length === 2) {
        if (
          depth[0] === 'feature' ||
          depth[0] === 'hooking' ||
          depth[0] === 'moving' ||
          depth[0] === 'promotionTitle' ||
          depth[0] === 'promotionDetail'
        ) {
          console.log(
            'scenarioGen_v3.process() > aiRequest[' +
              depth[0] +
              '][' +
              saveMarketingNum +
              '][' +
              depth[1] +
              '] =',
            aiRequest[depth[0]][saveMarketingNum][depth[1]],
          );
          tempTextType = aiRequest[depth[0]][saveMarketingNum][depth[1]];
        } else {
          tempTextType = aiRequest[depth[0]][depth[1]];
        }
      } else {
        if (
          depth[0] === 'feature' ||
          depth[0] === 'hooking' ||
          depth[0] === 'moving' ||
          depth[0] === 'promotionTitle' ||
          depth[0] === 'promotionDetail'
        ) {
          tempTextType =
            aiRequest[depth[0]][saveMarketingNum][depth[1]][depth[2]];
        } else {
          tempTextType = aiRequest[depth[0]][depth[1]][depth[2]];
        }
      }
      // 금액처리
      if (depth[1] === 'originalPrice' || depth[1] === 'promotionPrice') {
        if (usedLang === 'ko') {
          tempTextType = tempTextType + '원';
        } else {
          tempTextType = '$' + tempTextType;
        }
      }
      console.log('scenarioGen_v3.process() > tempTextType =', tempTextType);

      if (textDiviNum[i] > 1) {
        // text 분절 케이스
        await splitMsg(
          aiRequestId,
          usedLang,
          tempTextType,
          textDiviNum[i],
          textMaxChar[i],
          saveNum, // 배열저장 순서 처리용
        );
      } else {
        // text 분절 안하고 최대 글자수만 체크
        await textMaxCharMsg(
          aiRequestId,
          usedLang,
          tempTextType,
          textDiviNum[i],
          textMaxChar[i],
          saveNum, // 배열저장 순서 처리용
        );
      }

      // 카피 저장 순서
      saveNum += textDiviNum[i];
    }

    const scenarioCompletedReq = await AiRequest.findById(aiRequest._id);
    // 키워드 처리
    if (design.needImage + design.needVideo > 0) {
      let keywordInfo = await getKeywordWithScenario.process(
        scenarioCompletedReq.scenario.text,
        design,
        scenarioCompletedReq.lang,
        scenarioCompletedReq,
      );
      if (!keywordInfo.isSuccess)
        keywordInfo = await getKeywordWithScenario.process(
          scenarioCompletedReq.scenario.text,
          design,
          scenarioCompletedReq.lang,
          scenarioCompletedReq,
        );
      if (
        !keywordInfo.isSuccess ||
        keywordInfo.imageKeywords.length != design.needImage ||
        keywordInfo.videoKeywords.length != design.needVideo
      ) {
        console.log('KEYWORD FAILED COMPLETY');
        // STATUS -3
        throw 'KEYWORD FAILED COMPLETY';
      }

      scenarioCompletedReq.scenario.image = keywordInfo.imageKeywords;
      scenarioCompletedReq.scenario.video = keywordInfo.videoKeywords;

      await scenarioCompletedReq.save();
    }

    const aiRequestStatus = await AiRequest.findById(aiRequestId);
    aiRequestStatus.status = 5;
    await aiRequestStatus.save();

    if (aiRequestStatus.userId) {
      const user = await User.findById(aiRequestStatus.userId);
      if (user) {
        if (!user.usedScenarioGen) user.usedScenarioGen = 0;
        user.usedScenarioGen += 1;
        await user.save();
        console.log(
          user._id + ': usedScenarioGen ADDED : ' + user.usedScenarioGen,
        );
      }
    }

    return true;
  } catch (error) {
    console.log(error);
    console.log({ name: 'catch', status: 'failed', data: error });
    const aiRequest = await AiRequest.findById(aiRequestId);
    aiRequest.scenario.text = [];
    aiRequest.scenario.image = [];
    aiRequest.scenario.video = [];
    if (aiRequest.status != -1) {
      aiRequest.status = -3;
    }
    // aiRequest.usedPoint = usedPoint;
    await aiRequest.save();
    return false;
  }
};

// text 분절
async function splitMsg(
  aiRequestId,
  language,
  textType,
  textDiviNum,
  textMaxChar,
  saveNum,
) {
  console.log('splitMsg() > aiRequestId =', aiRequestId);
  console.log('splitMsg() > language =', language);
  console.log('splitMsg() > textType =', textType);
  console.log('splitMsg() > textDiviNum =', textDiviNum);
  console.log('splitMsg() > textMaxChar =', textMaxChar);
  console.log('splitMsg() > saveNum =', saveNum);
  try {
    let dataString = '';
    let jsonData = {};
    let prompt_json = '{';
    const textArr = [];
    for (let i = 0; i < textDiviNum; i++) {
      textArr.push('"text' + (i + 1) + '": """Insert Here"""');
      jsonData['text' + (i + 1)] = '';
    }
    // console.log('splitMsg() > textArr =', textArr);
    prompt_json += textArr.join() + '}';
    // const prompt_json = `{"text1": """Insert Here""", "text2": """Insert Here""", "text3": """Insert Here""", "text4": """Insert Here""", "text5": """Insert Here""", "text6": """Insert Here""", "text7": """Insert Here""", "text8": """Insert Here"""}`;
    // const regex =
    //   /{[^}]*"text1": "[^"]+"[^}]*"text2": "[^"]+"[^}]*"text3": "[^"]+"[^}]*"text4": "[^"]+"[^}]*"text5": "[^"]+"[^}]*"text6": "[^"]+"[^}]*"text7": "[^"]+"[^}]*"text8": "[^"]+"[^}]*}/g;
    // let textKeys = ['text1', 'text2', 'text3', 'text4', 'text5', 'text6', 'text7', 'text8'];
    let regexString = '{';
    for (let i = 0; i < textDiviNum; i++) {
      regexString += `[^}]*"${'text' + (i + 1)}": "[^"]+"`;
    }
    regexString += '[^}]*}';
    let regex = new RegExp(regexString, 'g');
    console.log('splitMsg() > regex =', regex);

    let currentObjectIndex = 0;
    let prompt;
    if (language === 'ko') {
      prompt = `숏폼 마케팅 영상에서 텍스트를 표현할건데, 줄을 바꿔가면서 표현하거나 여러개의 씬에 나눠서 표현할 수 있어서 다음의 메세지를 ${textDiviNum}번에 걸쳐서 표현해야 합니다. 말이 어색해지지 않게 이 문장을 ${textDiviNum}개의 텍스트로 나누고 ${prompt_json}의 json 형태로 표현해줘: ${textType}`;
    } else {
      prompt = `You need to express text in a short-form marketing video, and you can display it line by line or across multiple scenes. Divide the following message into ${textDiviNum} parts without making the sentences sound awkward. Provide the response in the JSON format ${prompt_json}: ${textType}`;
    }
    console.log('splitMsg() > prompt =', prompt);

    const response = await openai.chat.completions.create({
      model: CONF.openai.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: true,
      response_format: { type: 'json_object' },
    });

    for await (const chunk of response) {
      dataString += chunk?.choices[0]?.delta?.content;
      // console.log('splitMsg() > dataString =', dataString);

      jsonData = fillJsonData(dataString, jsonData, textDiviNum);
      // console.log('splitMsg() > jsonData =', jsonData);
      const tempArr = Object.values(jsonData);

      const aiRequest = await AiRequest.findById(aiRequestId);
      for (let i = 0; i < tempArr.length; i++) {
        const curCopyNum = saveNum + i;
        let text = tempArr[i];
        if (!text || text == '') text = ' ';
        aiRequest.scenario.text[curCopyNum] = text;
      }
      await aiRequest.save();

      if (chunk.choices[0].finish_reason === 'stop') {
        console.log('splitMsg() > SPLIT MSG FINISHED');
        console.log('splitMsg() > jsonData =', jsonData);
        break;
      }
    }
  } catch (error) {
    console.log('splitMsg() > error =', error);
    // return false;
  }
}
function fillJsonData(streamData, jsonData, textDiviNum) {
  const keys = [];
  for (let i = 0; i < textDiviNum; i++) {
    keys.push('text' + (i + 1));
  }
  // console.log('fillJsonData() > keys =', keys);
  for (let key of keys) {
    const value = extractValueByKeyOne(streamData, key);
    if (value) {
      jsonData[key] = value;
    }
  }
  return jsonData;
}
function extractValueByKeyOne(dataString, key) {
  const regex = new RegExp(`"${key}": "([^"]*)`, 'g');
  let results = '';
  const match = regex.exec(dataString);
  if (match !== null) {
    results = match[1];
  }
  return results;
}

// text 최대 글자수 체크
async function textMaxCharMsg(
  aiRequestId,
  language,
  textType,
  textDiviNum,
  textMaxChar,
  saveNum,
) {
  console.log('textMaxCharMsg() > aiRequestId =', aiRequestId);
  console.log('textMaxCharMsg() > language =', language);
  console.log('textMaxCharMsg() > textType =', textType);
  console.log('textMaxCharMsg() > textDiviNum =', textDiviNum);
  console.log('textMaxCharMsg() > textMaxChar =', textMaxChar);
  console.log('textMaxCharMsg() > saveNum =', saveNum);
  try {
    // if (textType.length > textMaxChar[0]) {
    //   // text를 줄여야 하는 경우
    //   let dataString = '';
    //   let jsonData = {
    //     text: '',
    //   };
    //   const prompt_json = `{"text": """Insert Here"""}`;

    //   let prompt;
    //   if (language === 'ko') {
    //     prompt = `숏폼 마케팅 영상에서 텍스트를 표현할건데, 다음의 메세지를 ${textDiviNum}번에 걸쳐서 이 텍스트를 표현해야 합니다. 말이 어색해지지 않게 이 문장을 최대 글자수 ${textMaxChar[0]}개를 넘지않게 표현해야 합니다. ${prompt_json}의 json 형태로 표현해줘: ${textType}`;
    //   } else {
    //     prompt = `I'm going to display text in a short form marketing video, and I need to display the following message ${textDiviNum} times. I need to display this text in a maximum of ${textMaxChar[0]} characters to avoid stuttering. I need it in json form in ${prompt_json}: ${textType}`;
    //   }
    //   console.log('textMaxCharMsg() > prompt =', prompt);

    //   const response = await openai.chat.completions.create({
    //     model: CONF.openai.model,
    //     messages: [
    //       {
    //         role: 'user',
    //         content: prompt,
    //       },
    //     ],
    //     stream: true,
    //     response_format: { type: 'json_object' },
    //   });

    //   for await (const chunk of response) {
    //     dataString += chunk?.choices[0]?.delta?.content;
    //     // console.log('textMaxCharMsg() > dataString =', dataString);

    //     jsonData = fillJsonDataFromMaxchar(dataString, jsonData);
    //     // console.log('textMaxCharMsg() > jsonData =', jsonData);
    //     const tempArr = Object.values(jsonData);
    //     // console.log('textMaxCharMsg() > tempArr =', tempArr);

    //     const aiRequest = await AiRequest.findById(aiRequestId);
    //     aiRequest.scenario.text[saveNum] = tempArr[0];
    //     await aiRequest.save();

    //     if (chunk.choices[0].finish_reason === 'stop') {
    //       // console.log('textMaxCharMsg() > TEXT MAXCHAR MSG FINISHED');
    //       // console.log('textMaxCharMsg() > jsonData =', jsonData);
    //       break;
    //     }
    //   }
    // } else {
    // text를 그냥 저장하는 경우
    const aiRequest = await AiRequest.findById(aiRequestId);

    // 초기화 필요
    aiRequest.scenario.text[saveNum] = '';
    await aiRequest.save();

    for (let i = 0; i < textType.length; i++) {
      // console.log(
      //   'textMaxCharMsg() > textType.charAt(i) =',
      //   textType.charAt(i),
      // );
      // console.log(
      //   'textMaxCharMsg() > aiRequest.scenario.text[saveNum] =',
      //   aiRequest.scenario.text[saveNum],
      // );
      aiRequest.scenario.text[saveNum] += textType.charAt(i);
      await aiRequest.save();
      await wait(100);
    }

    let tempArr = [];
    for (let item of aiRequest.scenario.text) {
      if (item === '') item = ' ';
      tempArr.push(item);
    }
    aiRequest.scenario.text = tempArr;
    await aiRequest.save();
  } catch (error) {
    console.log('textMaxCharMsg() > error =', error);
    // return false;
  }
}

