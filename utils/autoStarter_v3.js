// GPT CONFIG
const OpenAI = require('openai');

const CONF = require('../config');

const AiRequest = require('../models/aiRequest_v2');
const Design = require('../models/design');
const Subtemplate = require('../models/subtemplate');

const scenarioGen_v3 = require('./genScenario_v3');
const AutoMapper_v3 = require('./autoMapper_v3');

const openai = new OpenAI({
  apiKey: CONF.openai.API_KEY,
});

let errorList = [];

const categoryArr = ['Promotion', 'Product Intro', 'Branding']; //['UNDEFINED', '프로모션', '제품 소개', '브랜딩']

const promptLang = {
  ko: 'Korean',
  en: 'English',
  id: 'Indonesian',
};

exports.process = () => {
  checkAdPlanningComplete();
  watchToSelectDesign();
  watchToAiCompletion();
  rateLimitHandler();

  AiRequest.watch(
    [
      {
        $match: {
          $and: [
            { 'fullDocument.requestType': 2 },
            {
              $or: [
                { 'fullDocument.status': { $eq: null } },
                { 'fullDocument.status': { $eq: 0 } },
              ],
            },
          ],
        },
      },
    ],
    { fullDocument: 'updateLookup' },
  ).on('change', async (data) => {
    if (data.operationType === 'insert') {
      if (data.fullDocument.status == null || data.fullDocument.status == 0) {
        const aiRequestId = data.fullDocument._id;
        const aiRequest = await AiRequest.findByIdAndUpdate(aiRequestId, {
          status: 1,
        });
        console.log(
          'exports.process() > AI 제작하기 시작 - ' + data.fullDocument._id,
        );
        startGPT(aiRequest);
      }
    } else if (data.operationType === 'update') {
      const updatedFields = Object.keys(
        data.updateDescription.updatedFields || {},
      );
      if (
        updatedFields.includes('status') &&
        (data.fullDocument.status == null || data.fullDocument.status == 0)
      ) {
        const aiRequestId = data.fullDocument._id;
        const aiRequest = await AiRequest.findByIdAndUpdate(aiRequestId, {
          status: 1,
        });
        console.log(
          'exports.process() > AI 광고 기획 시작 (실패로 인한 재시도)- ' +
            data.fullDocument._id,
        );
        startGPT(aiRequest);
      }
    }
    // }
  });
};

// 페르소나, 제품특징, 후킹포인트, 감동포인트 GPT 요청 시작
async function startGPT(aiRequest) {
  try {
    const productInfo = createProductInfo(aiRequest);
    console.log('startGPT() > productInfo =', productInfo);
    const category = aiRequest.category - 101;

    const reqData = {
      category: category,
      prod: JSON.stringify(productInfo.product),
      language: aiRequest.lang,
      target: productInfo.target,
    };

    let persona;
    if (aiRequest.userPersona && aiRequest.userPersona != '') {
      const transResult = await getTranslation(reqData, aiRequest._id);
      aiRequest.feature.push(aiRequest.feature[aiRequest.feature.length - 1]);
      aiRequest.persona.push({
        character: aiRequest.userPersona,
      });
      persona = aiRequest.userPersona;

      if (reqData.category === 0) {
        // 프로모션인 경우
        getPromotion(reqData, aiRequest._id, persona, transResult);
        aiRequest.promotionTitleInfoFinished = false;
      } else {
        // 제품정보인 경우
        getHooking(reqData, aiRequest._id, persona, transResult);
        aiRequest.hookingFinished = false;
        getMoving(reqData, aiRequest._id, persona, transResult);
        aiRequest.movingFinished = false;
      }

      getCopy(reqData, aiRequest._id, persona, transResult); // 업로드시 사용하고 시나리오 생성에선 CTA문구 활용
      getCTA(reqData, aiRequest._id, persona, transResult);
      aiRequest.copyFinished = false;
      aiRequest.userPersona = '';
      await aiRequest.save();
    } else {
      const transResult = await getTranslation(reqData, aiRequest._id);
      getFeature(reqData, aiRequest._id, transResult);
      persona = await getPersona(reqData, aiRequest._id, transResult);

      if (reqData.category === 0) {
        // 프로모션인 경우
        getPromotion(reqData, aiRequest._id, persona, transResult);
      } else {
        // 제품정보인 경우
        getHooking(reqData, aiRequest._id, persona, transResult);
        getMoving(reqData, aiRequest._id, persona, transResult);
      }

      getCopy(reqData, aiRequest._id, persona, transResult); // 업로드시 사용하고 시나리오 생성에선 CTA문구 활용
      getCTA(reqData, aiRequest._id, persona, transResult);
    }
  } catch (error) {
    console.log('startGPT() > error', error);
  }
}
function createProductInfo(aiRequest) {
  let category = aiRequest.category;
  let lang = aiRequest.lang;
  let cateNum = category - 100;
  let data = {};
  data.target = aiRequest.target;

  let originalPrice;
  if (aiRequest.priceInfo.currency === 'KRW') {
    originalPrice = aiRequest.priceInfo.originalPrice + '원';
  } else {
    originalPrice = '$' + aiRequest.priceInfo.originalPrice;
  }

  let discountPrice;
  if (aiRequest.priceInfo.currency === 'KRW') {
    discountPrice = aiRequest.priceInfo.discountPrice + '원';
  } else {
    discountPrice = '$' + aiRequest.priceInfo.discountPrice;
  }

  switch (cateNum) {
    case 1: // 프로모션
      (data.category = categoryArr[category - 101]),
        (data.language = lang),
        (data.product = {
          product_name: aiRequest.name,
          product_price: originalPrice,
          product_info: aiRequest.detail,
        });
      if (aiRequest.priceInfo.discountPrice)
        data.product.product_discount = discountPrice;
      break;
    case 2: // 제품 소개
      (data.category = categoryArr[category - 101]),
        (data.language = lang),
        (data.product = {
          product_name: aiRequest.name,
          product_price: originalPrice,
          product_info: aiRequest.detail,
        });
      if (aiRequest.priceInfo.discountPrice)
        data.product.product_discount = discountPrice;
      break;
    case 3: // 브랜딩
      (data.category = categoryArr[category - 101]),
        (data.language = lang),
        (data.product = {
          brand_name: aiRequest.name,
          product_price: originalPrice,
          brand_info: aiRequest.detail,
        });
      if (aiRequest.priceInfo.discountPrice)
        data.product.product_discount = discountPrice;
      break;
  }

  return data;
}

// 제품 번역
async function getTranslation(reqData, aiRequestId) {
  try {
    console.log('getTranslation() > reqData =', reqData);
    console.log('getTranslation() > aiRequestId =', aiRequestId);

    const aiRequest = await AiRequest.findById(aiRequestId);

    const prompt =
      `Translate the following JSON data into the target language. If the target language is the same as the source language, return the JSON data as {"changed":null}. Here is the data:\n\n` +
      reqData.prod +
      `\n\nTarget Language: ${promptLang[aiRequest.lang]}`;
    console.log('getTranslation() > prompt =', prompt);

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: true,
      response_format: { type: 'json_object' },
    });

    let resultDate;
    let translation;
    for await (const chunk of response) {
      if (chunk.error) {
        const aiRequest = await AiRequest.findById(aiRequestId);
        aiRequest.failedAt = new Date();
        aiRequest.status = -1;
        console.log(`getTranslation() > ERROR IN - ${aiRequest._id}`);
        await aiRequest.save();
        break;
      }

      translation = translation + chunk.choices[0].delta.content;

      if (chunk.choices[0].finish_reason === 'stop') {
        console.log('getTranslation() > PRODUCT TRANSLATION FINISHED');
        console.log('getTranslation() > translation =', translation);

        translation = translation.split('undefined')[1];
        var valid = JSON.parse(translation);
        var key = 'changed';

        if (key in valid) {
          console.log('getTranslation() > 번역 안함');
          resultDate = reqData.prod;
        } else {
          console.log('getTranslation() > 번역함');
          resultDate = translation;
        }

        break;
      }
    }

    return resultDate;
  } catch (error) {
    console.log('getTranslation() > error =', error);
  }
}

// 페르소나 GPT 요청
async function getPersona(reqData, aiRequestId, transResult) {
  try {
    console.log('getPersona() > reqData =', reqData);
    console.log('getPersona() > aiRequestId =', aiRequestId);

    let target_data_obj = null;
    let target_data = null;
    if (reqData.target && reqData.target != '')
      target_data_obj = reqData.target;
    console.log('getPersona() > target_data_obj =', target_data_obj);

    // 타겟테이터 처리
    const age_data = {
      ko: {
        0: '전체 연령',
        1: '10대',
        2: '20대',
        3: '30대',
        4: '40대',
        5: '50대',
        6: '60대 이상',
      },
      en: {
        0: 'All ages',
        1: '10s',
        2: '20s',
        3: '30s',
        4: '40s',
        5: '50s',
        6: '60s+',
      },
    };
    const gender_data = {
      ko: {
        0: '전체 성별',
        1: '남성',
        2: '여성',
      },
      en: {
        0: 'All genders',
        1: 'male',
        2: 'female',
      },
    };

    let reqLang = 'ko';
    if (reqData.language != 'ko') reqLang = 'en';

    if (target_data_obj.age[0] === 0) {
      target_data = age_data[reqLang][0];
    } else {
      const ageResult = [];
      for (const item of target_data_obj.age) {
        ageResult.push(age_data[reqLang][item]);
      }
      target_data = ageResult.join();
    }

    if (target_data_obj.gender) {
      target_data =
        target_data + ' ' + gender_data[reqLang][target_data_obj.gender];
    } else {
      target_data = target_data + ' ' + gender_data[reqLang][0];
    }

    const aiRequest = await AiRequest.findById(aiRequestId);
    const saveNum = aiRequest.persona.length;

    let dataString = '';
    let jsonData = {
      character: '',
      lifestyle: '',
      interest: '',
      feature: '',
    };

    const persona_json = `{"character": """Insert Here""", "lifestyle": """Insert Here""", "interest": """Insert Here""", "feature": """Insert Here"""}`;

    const regex =
      /{[^}]*"character": "[^"]+"[^}]*"lifestyle": "[^"]+"[^}]*"interest": "[^"]+"[^}]*"feature": "[^"]+"[^}]*}/g;

    let persona_prompt;
    if (reqData.language === 'ko') {
      persona_prompt = `당신은 이 제품을 가장 필요로할만한 고객의 페르소나를 작성해야 합니다. ${target_data}을 타겟고객으로 설정하였으며 제품의 정보를 기준으로 필요성을 느낄 사람이 잘 매칭되도록 표현해야 합니다. 이 사람을 한마디로 정의한 표현 1개를 6단어 이내로 작성하고 라이프스타일, 관심사, 특징을 작성하되 각각은 20단어 이내로 작성하며 내용은 한글이어야 합니다. ${persona_json}의 json 형태로 답변해야 합니다.`;
    } else {
      persona_prompt = `You need to create a persona for the customer who would need this product the most. Set ${target_data} as the target customer, express the persona matched well with person who needs the product based on product information. Write one expression defining this person in up to 6 words, and describe their lifestyle, interests, and characteristics, each within 20 words. The content should be in language of ${
        promptLang[aiRequest.lang]
      }. So if you need translation, do it. Provide the response in the JSON format ${persona_json}.`;
    }
    console.log('getPersona() > persona_prompt =', persona_prompt);
    const response = await openai.chat.completions.create({
      model: CONF.openai.model,
      messages: [
        {
          role: 'assistant',
          content: persona_prompt,
        },
        {
          role: 'user',
          content: transResult,
        },
      ],
      stream: true,
      response_format: { type: 'json_object' },
    });

    for await (const chunk of response) {
      if (chunk.error) {
        aiRequest.failedAt = new Date();
        aiRequest.status = -1;
        aiRequest.personaFinished = false;
        console.log(`getPersona() > ERROR IN - ${aiRequest._id}`);
        await aiRequest.save();
        break;
      }

      dataString += chunk?.choices[0]?.delta?.content;

      jsonData = fillJsonDataFromPersona(dataString, jsonData);

      const aiRequest = await AiRequest.findById(aiRequestId);
      aiRequest.persona[saveNum] = jsonData;
      await aiRequest.save();

      if (chunk.choices[0].finish_reason === 'stop') {
        const aiRequest = await AiRequest.findById(aiRequestId);
        console.log('getPersona() > PERSONA PLANING FINISHED');
        console.log('getPersona() > jsonData =', jsonData);
        aiRequest.personaFinished = true;
        await aiRequest.save();
        break;
      }
    }
    return jsonData;
  } catch (error) {
    console.log('getPersona() > error =', error);
  }
}
function fillJsonDataFromPersona(streamData, jsonData) {
  const keys = ['character', 'lifestyle', 'interest', 'feature'];
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

// 제품특징 GPT 요청
async function getFeature(reqData, aiRequestId, transResult) {
  try {

    const aiRequest = await AiRequest.findById(aiRequestId);
    const saveNum = aiRequest.feature.length;

    let dataString = '';
    let jsonData = [
      { feature: '', short: '', detailed: '' },
      { feature: '', short: '', detailed: '' },
      { feature: '', short: '', detailed: '' },
      { feature: '', short: '', detailed: '' },
      { feature: '', short: '', detailed: '' },
    ];

    const feature_json = `{"product_feature": [{"feature": """Insert Here""", "short": """Insert Here", "detailed": """Insert Here"""}, ...]}`;

    const regex =
      /{[^}]*"feature": "[^"]+"[^}]*"short": "[^"]+"[^}]*"detailed": "[^"]+"[^}]*}/g;
    let currentObjectIndex = 0;

    let feature_prompt;
    if (reqData.language === 'ko') {
      feature_prompt = `당신은 제품정보를 토대로 콘텐츠에서 쓸 타겟 고객 후킹 메세지를 작성하는 마케터 입니다. 10자 이내로 제품의 특징을 추출하고 각 특징을 강조하는 용도의 마케팅 문구를 임팩트 있고 짧게 표현하며 총 10 단어를 넘지 않는 버전과 상세하게 설명하지만 총 20단어를 넘지 않는 버전의 2가지를 작성해야 합니다. 제품의 특징은 최대 5개 이하로 추출해야 하며 마케팅 문구는 실제 말하는 듯한 구어체의 톤앤매너를 적용해야 하며 내용은 한글이어야 하고 ${feature_json}의 json 형태로 작성해줘.`;
    } else {
      feature_prompt = `You are a marketer creating target customer hooking messages for online content based on product information. Write the features of the product within 5 words and marketing phrases emphasizing each feature. The features and phrases must be written in language of ${
        promptLang[aiRequest.lang]
      }. The phrases should be impactful and concise, with one version not exceeding 10 words and another detailed version not exceeding 20 words. Extract up to 5 product features, and the marketing phrases should be in a conversational tone. The output should be in the JSON format ${feature_json}.`;
    }
    console.log('getFeature() > feature_prompt =', feature_prompt);
    const response = await openai.chat.completions.create({
      model: CONF.openai.model,
      messages: [
        {
          role: 'assistant',
          content: feature_prompt,
        },
        {
          role: 'user',
          content: JSON.stringify(transResult),
        },
      ],
      stream: true,
      response_format: { type: 'json_object' },
    });

    for await (const chunk of response) {
      if (chunk.error) {
        aiRequest.failedAt = new Date();
        aiRequest.status = -1;
        aiRequest.featureFinished = false;
        console.log(`getFeature() > ERROR IN - ${aiRequest._id}`);
        await aiRequest.save();
        break;
      }

      dataString += chunk?.choices[0]?.delta?.content;
      const matched = dataString.match(regex);
      currentObjectIndex = matched ? matched.length : 0;

      jsonData = fillJsonDataFromFeature(
        dataString,
        jsonData,
        currentObjectIndex,
      );

      const aiRequest = await AiRequest.findById(aiRequestId);
      aiRequest.feature[saveNum] = jsonData;
      await aiRequest.save();

      if (chunk.choices[0].finish_reason === 'stop') {
        const aiRequest = await AiRequest.findById(aiRequestId);
        console.log('getFeature() > FEATURE PLANING FINISHED');
        console.log('getFeature() > jsonData =', jsonData);
        aiRequest.featureFinished = true;
        await aiRequest.save();
        break;
      }
    }
  } catch (error) {
    console.log('getFeature() > error =', error);
  }
}
function fillJsonDataFromFeature(streamData, jsonData, currentObjectIndex) {
  const keys = ['feature', 'short', 'detailed'];

  if (currentObjectIndex >= 0 && currentObjectIndex < jsonData.length) {
    for (let key of keys) {
      const value = extractValueByKey(streamData, key, currentObjectIndex);
      if (value) {
        jsonData[currentObjectIndex][key] = value;
      }
    }
  }

  return jsonData;
}
function extractValueByKey(dataString, key, currentIndex) {
  const regex = new RegExp(`"${key}": "([^"]*)`, 'g');
  let match;
  let results = [];

  while ((match = regex.exec(dataString)) !== null) {
    results.push(match[1]);
  }
  return results[currentIndex] || '';
}

// 후킹포인트 GPT 요청
async function getHooking(reqData, aiRequestId, persona, transResult) {
  try {
    const aiRequest = await AiRequest.findById(aiRequestId);
    const saveNum = aiRequest.hooking.length;

    let dataString = '';
    let jsonData = {
      short: '',
      detailed: '',
    };

    const hooking_product_json = `{"catchphrase_question": {"short": """Insert Here""", "detailed": """Insert Here"""}}`;

    const regex = /{[^}]*"short": "[^"]+"[^}]*"detailed": "[^"]+"[^}]*}/g;

    let hooking_prompt;

    if (reqData.language === 'ko') {
      hooking_prompt = `당신은 이 제품정보와 고객 페르소나를 토대로 콘텐츠에서 고객을 후킹할만한 캐치프레이즈를 작성하는 마케터 입니다. 이 제품이 필요할만한 고객 페르소나를 기반으로 이 제품이 없었을 때의 고객이 겪고 있던 불편함이나 어려움을 질문 형태로 제안하는 캐치프레이즈가 필요합니다. 이 때 제품을 직접적으로 드러내지 말고 고객이 불편하거나 무언가 필요로 하는 상황에 더 집중합니다. 이러한 캐치프레이즈를 10개 단어 내외 버전 1개와 20개 단어 내외 버전 1개로 총 2개를 작성하며, 내용은 한글로 표현해야 합니다. 이 캐치프레이즈들은 구어체로 친근하게 표현하는 톤앤매너를 적용하고 ${hooking_product_json}의 json 형태로 작성하세요.`;
    } else {
      hooking_prompt = `You are a marketer creating catch phrases to hook customers based on product information and customer persona. You need a catchphrase in the form of a question that suggests the inconveniences or difficulties the customer persona might face without this product. Focus more on the situations where the customer feels discomfort or need rather than directly mentioning the product. Write two versions of this catchphrase: one within 10 words and another within 20 words. The content should be in language of ${
        promptLang[aiRequest.lang]
      } and expressed in a friendly, conversational tone. So if you need translation, do it. Provide the response in the JSON format ${hooking_product_json}.`;
    }
    console.log('getHooking() > hooking_prompt =', hooking_prompt);

    const response = await openai.chat.completions.create({
      model: CONF.openai.model,
      messages: [
        {
          role: 'assistant',
          content: hooking_prompt,
        },
        {
          role: 'user',
          content: transResult + JSON.stringify(persona),
        },
      ],
      stream: true,
      response_format: { type: 'json_object' },
    });

    for await (const chunk of response) {
      if (chunk.error) {
        aiRequest.failedAt = new Date();
        aiRequest.status = -1;
        aiRequest.hookingFinished = false;
        console.log(`getHooking() > ERROR IN - ${aiRequest._id}`);
        await aiRequest.save();
        break;
      }

      dataString += chunk?.choices[0]?.delta?.content;
      const matched = dataString.match(regex);

      jsonData = fillJsonDataFromHooking(dataString, jsonData);

      const aiRequest = await AiRequest.findById(aiRequestId);
      aiRequest.hooking[saveNum] = jsonData;
      await aiRequest.save();

      if (chunk.choices[0].finish_reason === 'stop') {
        const aiRequest = await AiRequest.findById(aiRequestId);
        console.log('getHooking() > HOOKING PLANING FINISHED');
        console.log('getHooking() > jsonData =', jsonData);
        aiRequest.hookingFinished = true;
        await aiRequest.save();
        break;
      }
    }
  } catch (error) {
    console.log('getHooking() > error =', error);
  }
}
function fillJsonDataFromHooking(streamData, jsonData) {
  const keys = ['short', 'detailed'];
  for (let key of keys) {
    const value = extractValueByKeyOne(streamData, key);
    if (value) {
      jsonData[key] = value;
    }
  }
  return jsonData;
}

// 감동포인트 GPT 요청
async function getMoving(reqData, aiRequestId, persona, transResult) {
  try {
    const aiRequest = await AiRequest.findById(aiRequestId);
    const saveNum = aiRequest.moving.length;

    let dataString = '';
    let jsonData = {
      short: '',
      detailed: '',
    };

    const moving_json = `{"catchphrase_benefit": {"short": """Insert Here""", "detailed": """Insert Here"""}}`;
    const moving_promotion_json = `{"catchphrase_promo": {"short": """Insert Here""", "detailed": """Insert Here"""}}`;

    const regex = /{[^}]*"short": "[^"]+"[^}]*"detailed": "[^"]+"[^}]*}/g;

    let moving_prompt;
    // 제품소개인 경우
    if (reqData.language === 'ko') {
      moving_prompt = `당신은 이 제품정보와 고객 페르소나를 토대로 콘텐츠에서 고객을 후킹할만한 캐치프레이즈를 작성하는 마케터 입니다. 이 제품의 고객 페르소나를 기반으로 이 제품을 사용했을 때 고객이 느낄 수 있는 효용가치를 표현하는 캐치프레이즈가 필요합니다. 이 때 제품명이나 제품정보를 드러내지 말고 제품을 사용했을 때 고객이 느낄 수 있는 효과, 혜택, 개선 등의 상황에만 더 집중합니다. 이러한 캐치프레이즈를 10단어 내외 버전 1개와 20단어 내외 버전 1개로 총 2개를 작성하며 내용은 한글로 표현해야 합니다. 이 캐치프레이즈들은 구어체로 친근하게 표현하는 톤앤매너를 적용하고 ${moving_json}의 json 형태로 작성하세요.`;
    } else {
      moving_prompt = `You are a marketer creating catchy phrases to hook customers based on product information and customer persona. You need a catchphrase that expresses the value customers will experience when using this product, based on the customer persona. Focus on the effects, benefits, and improvements customers will feel when using the product, without revealing the product name or details. Write two versions of this catchphrase: one within 10 words and another within 20 words. The content should be in language of ${
        promptLang[aiRequest.lang]
      } and expressed in a friendly, conversational tone. So if you need translation, do it. Provide the response in the JSON format ${moving_json}.`;
    }
    console.log('getMoving() > moving_prompt =', moving_prompt);

    const response = await openai.chat.completions.create({
      model: CONF.openai.model,
      messages: [
        {
          role: 'assistant',
          content: moving_prompt,
        },
        {
          role: 'user',
          content: transResult + JSON.stringify(persona),
        },
      ],
      stream: true,
      response_format: { type: 'json_object' },
    });

    for await (const chunk of response) {
      if (chunk.error) {
        aiRequest.failedAt = new Date();
        aiRequest.status = -1;
        aiRequest.movingFinished = false;
        console.log(`getMoving() > ERROR IN - ${aiRequest._id}`);
        await aiRequest.save();
        break;
      }

      dataString += chunk?.choices[0]?.delta?.content;

      jsonData = fillJsonDataFromMoving(dataString, jsonData);

      const aiRequest = await AiRequest.findById(aiRequestId);
      aiRequest.moving[saveNum] = jsonData;
      await aiRequest.save();

      if (chunk.choices[0].finish_reason === 'stop') {
        const aiRequest = await AiRequest.findById(aiRequestId);
        console.log('getMoving() > MOVING PLANING FINISHED');
        console.log('getMoving() > jsonData =', jsonData);
        aiRequest.movingFinished = true;
        await aiRequest.save();
        break;
      }
    }
  } catch (error) {
    console.log('getMoving() > error =', error);
  }
}
function fillJsonDataFromMoving(streamData, jsonData) {
  const keys = ['short', 'detailed'];
  for (let key of keys) {
    const value = extractValueByKeyOne(streamData, key);
    if (value) {
      jsonData[key] = value;
    }
  }
  return jsonData;
}

// 프로모션 GPT 요청
async function getPromotion(reqData, aiRequestId, persona, transResult) {
  try {
    const aiRequest = await AiRequest.findById(aiRequestId);
    const saveNum = aiRequest.promotionTitle.length;

    let dataString = '';
    let jsonData = {
      short: '',
      detailed: '',
    };

    const moving_promotion_json = `{"catchphrase_promo": {"short": """Insert Here""", "detailed": """Insert Here"""}}`;

    const regex = /{[^}]*"short": "[^"]+"[^}]*"detailed": "[^"]+"[^}]*}/g;

    let prompt;

    // 프로모션인 경우
    if (reqData.language === 'ko') {
      prompt = `당신은 이 제품정보와 고객 페르소나 그리고 프로모션 정보를 토대로 콘텐츠에서 고객을 후킹할만한 캐치프레이즈를 작성하는 마케터 입니다. 이 제품의 고객 페르소나를 기반으로 이 제품을 사용했을 때 고객이 느낄 수 있는 효용가치를 언급하는 프로모션 내용 강조형의 캐치프레이즈가 필요합니다. 만약 프로모션 내용이 부족하다고 기간 등의 프로모션 정보에는 없는 내용을 임의로 생성해서 표현해서는 안됩니다. 하지만 미사어구 등의 표현을 통해 프로모션 정보를 더욱 풍성하게 표현해주세요. 이러한 캐치프레이즈를 10단어 내외 버전 1개와 20단어 내외 버전 1개로 총 2개를 작성하며 내용은 한글로 표현해야 합니다. 이 캐치프레이즈들은 구어체로 친근하게 표현하는 톤앤매너를 적용하고  ${moving_promotion_json}의 json 형태로 작성하세요.`;
    } else {
      prompt = `You are a marketer creating catch phrases to hook customers based on product information, customer persona, and promotion details. You need a promotional catchphrase that emphasizes the value customers will experience when using this product, based on the customer persona. Do not create or add any promotional details such as promotion period that are not provided. However, use embellishments to make the promotional information sound richer. Write two versions of this catchphrase: one within 10 words and another within 20 words. The content should be in language of ${
        promptLang[aiRequest.lang]
      } and expressed in a friendly, conversational tone. So if you need translation, do it. Provide the response in the JSON format ${moving_promotion_json}.`;
    }
    console.log('getPromotion() > prompt =', prompt);

    const response = await openai.chat.completions.create({
      model: CONF.openai.model,
      messages: [
        {
          role: 'assistant',
          content: prompt,
        },
        {
          role: 'user',
          content: transResult + JSON.stringify(persona),
        },
      ],
      stream: true,
      response_format: { type: 'json_object' },
    });

    for await (const chunk of response) {
      if (chunk.error) {
        aiRequest.failedAt = new Date();
        aiRequest.status = -1;
        aiRequest.promotionTitleInfoFinished = false;
        console.log(`getPromotion() > ERROR IN - ${aiRequest._id}`);
        await aiRequest.save();
        break;
      }

      dataString += chunk?.choices[0]?.delta?.content;

      jsonData = fillJsonDataFromMoving(dataString, jsonData);

      const aiRequest = await AiRequest.findById(aiRequestId);
      aiRequest.promotionTitle[saveNum] = jsonData.short;
      aiRequest.promotionDetail[saveNum] = jsonData.detailed;
      await aiRequest.save();

      if (chunk.choices[0].finish_reason === 'stop') {
        const aiRequest = await AiRequest.findById(aiRequestId);
        console.log('getPromotion() > PROMOTION PLANING FINISHED');
        console.log('getPromotion() > jsonData =', jsonData);
        aiRequest.promotionTitleInfoFinished = true;
        await aiRequest.save();
        break;
      }
    }
  } catch (error) {
    console.log('getPromotion() > error =', error);
  }
}

// 카피 GPT 요청 - 업로드시 카피생성
async function getCopy(reqData, aiRequestId, persona, transResult) {
  try {
    console.log('getCopy() > reqData =', reqData);
    console.log('getCopy() > aiRequestId =', aiRequestId);
    console.log('getCopy() > persona =', persona);

    const aiRequest = await AiRequest.findById(aiRequestId);

    const prompt_json = `{"catchphrase": """Text Here""","overview": """Text Here""","feature": ["""Text Here""", ...],"CTA": """Text Here"""}`;

    let prompt;

    if (reqData.language === 'ko') {
      prompt = `당신은 소셜미디어 포스팅에 필요한 글을 작성하는 마케터 입니다. 이미 콘텐츠의 주제가 확정되어 있고 영상 또는 이미지 콘텐츠는 준비가 되어 있습니다. 이제 이 콘텐츠를 잘 소개할 수 있는 글을 작성해야 합니다. 먼저 글의 구조에는 다음의 내용이 포함됩니다.{캐치프레이즈}{고객 공감 형 개요}{제품의 특징 설명}{CTA 문구}고객 공감 형 개요는 고객의 패인 포인트에 공감하듯 이야기하고 제품의 강점으로 혜택이 느껴지도록 풀어 써주세요. 무언가를 '해결한다' 라는 뉘앙스로 표현하지는 말아주세요. 제품의 특징 설명만 이모티콘을 활용해서 표현하고 다른 구성요소에는 이모티콘을 활용하지 않습니다.제품의 특징 설명은 제품 정보에서 표현한 내용에 미사어구를 덧붙여 풍성하게 표현하되 거짓된 정보가 되지 않게 해주세요. 그리고 그 어디에도 해시태그를 생성하지 마세요. 내용은 한글로 작성하세요. 다음의 json 구조로 응답해주세요:${prompt_json}`;
    } else {
      prompt = `You are a marketer responsible for writing text needed for social media posts. The content topic has already been decided, and the video or image content is ready. Now, you need to write text that introduces this content well. The structure of the text should include the following elements: {Catchphrase}{Customer Empathy Overview}{Product Feature Description}{CTA Phrase}. In the Customer Empathy Overview, write as if you empathize with the customer's pain points and convey the benefits of the product's strengths without expressing it as "solving" something. Use emojis only in the Product Feature Description and not in any other sections. The Product Feature Description should be richly expressed with embellishments based on the product information, without becoming false information. Do not generate hashtags anywhere. Write the content in language of ${
        promptLang[aiRequest.lang]
      }. Respond in the following JSON structure:${prompt_json}`;
    }
    console.log('getCopy() > prompt =', prompt);

    const response = await openai.chat.completions.create({
      model: CONF.openai.model,
      messages: [
        {
          role: 'assistant',
          content: prompt,
        },
        {
          role: 'user',
          content: transResult + JSON.stringify(persona),
        },
      ],
      stream: false,
      response_format: { type: 'json_object' },
    });

    console.log(
      'getCopy() > JSON.parse(response.choices[0].message.content) =',
      JSON.parse(response.choices[0].message.content),
    );

    aiRequest.copy = JSON.parse(response.choices[0].message.content);
    aiRequest.copyFinished = true;
    await aiRequest.save();
  } catch (error) {
    console.log('getCopy() > error =', error);
    const aiRequest = await AiRequest.findById(aiRequestId);
    aiRequest.copyFinished = false;
    console.log(`getCopy() > ERROR IN - ${aiRequest._id}`);
    await aiRequest.save();
  }
}

// CTA GPT 요청 - CTA문구용 생성
async function getCTA(reqData, aiRequestId, persona, transResult) {
  try {
    console.log('getCTA() > reqData =', reqData);
    console.log('getCTA() > aiRequestId =', aiRequestId);
    console.log('getCTA() > persona =', persona);

    const aiRequest = await AiRequest.findById(aiRequestId);

    const prompt_json = `{"cta": """Text Here"""}`;

    let prompt;

    if (reqData.language === 'ko') {
      prompt = `당신은 이 제품정보로 생성하는 콘텐츠 마지막에 고객의 행동을 유도할 CTA 문구를 작성해야 합니다. 10 단어 내외로 작성하며 한글로 작성해야 합니다. 다음의 json 구조로 응답해주세요:${prompt_json}`;
    } else {
      prompt = `You are the marketer who write the CallToAction message. Write a sentence within 10 words and express in language of ${
        promptLang[aiRequest.lang]
      }. Please return the data as json format like:${prompt_json}`;
    }
    console.log('getCTA() > prompt =', prompt);

    const response = await openai.chat.completions.create({
      model: CONF.openai.model,
      messages: [
        {
          role: 'assistant',
          content: prompt,
        },
        {
          role: 'user',
          content: transResult + JSON.stringify(persona),
        },
      ],
      stream: false,
      response_format: { type: 'json_object' },
    });

    console.log(
      'getCTA() > JSON.parse(response.choices[0].message.content) =',
      JSON.parse(response.choices[0].message.content),
    );

    aiRequest.cta = JSON.parse(response.choices[0].message.content);
    aiRequest.ctaFinished = true;
    await aiRequest.save();
  } catch (error) {
    console.log('getCTA() > error =', error);
    const aiRequest = await AiRequest.findById(aiRequestId);
    aiRequest.ctaFinished = false;
    console.log(`getCTA() > ERROR IN - ${aiRequest._id}`);
    await aiRequest.save();
  }
}

// 광고 기획 전체 완료됬는지 확인
function checkAdPlanningComplete() {
  AiRequest.watch(
    [
      {
        $match: {
          $and: [
            {
              $or: [
                {
                  $and: [
                    { 'fullDocument.requestType': 2 },
                    { 'fullDocument.status': 1 },
                    { 'fullDocument.category': 102 }, // 제품정보

                    { 'fullDocument.personaFinished': true },
                    { 'fullDocument.featureFinished': true },
                    { 'fullDocument.hookingFinished': true },
                    { 'fullDocument.movingFinished': true },
                    { 'fullDocument.copyFinished': true },
                    { 'fullDocument.ctaFinished': true },
                  ],
                },
                {
                  $and: [
                    { 'fullDocument.requestType': 2 },
                    { 'fullDocument.status': 1 },
                    { 'fullDocument.category': 101 }, // 프로모션

                    { 'fullDocument.personaFinished': true },
                    { 'fullDocument.featureFinished': true },
                    { 'fullDocument.promotionTitleInfoFinished': true },
                    { 'fullDocument.copyFinished': true },
                    { 'fullDocument.ctaFinished': true },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
    { fullDocument: 'updateLookup' },
  ).on('change', async (data) => {
    console.log('checkAdPlanningComplete() > 맨위');
    if (data.operationType === 'update') {
      try {
        console.log(
          'checkAdPlanningComplete() > 광고 기획 전체 완료 : ' +
            data.fullDocument._id,
        );
        const aiRequestId = data.fullDocument._id;
        const aiRequest = await AiRequest.findById(aiRequestId);

        console.log('checkAdPlanningComplete() > 111');

        const subtemplate = await Subtemplate.findById(aiRequest.subtemplateId);
        if (!subtemplate) {
          aiRequest.status = 2;
        } else {
          aiRequest.status = 3;
        }
        console.log('checkAdPlanningComplete() > subtemplate =', subtemplate);
        console.log('checkAdPlanningComplete() > status =', aiRequest.status);
        console.log('checkAdPlanningComplete() > 222');

        aiRequest.marketingPlan = true;

        await aiRequest.save();
      } catch (error) {
        console.log('checkAdPlanningComplete() > error =', error);
      }
    }
  });
}

// 시나리오 생성
function watchToSelectDesign() {
  AiRequest.watch(
    [
      {
        $match: {
          $and: [
            { 'fullDocument.requestType': 2 },
            { 'fullDocument.status': 3 },
            { 'fullDocument.marketingPlan': true },
            { 'fullDocument.subtemplateId': { $ne: null, $ne: '' } },
          ],
        },
      },
    ],
    { fullDocument: 'updateLookup' },
  ).on('change', async (data) => {
    if (data.operationType === 'update') {
      const updatedFields = Object.keys(
        data.updateDescription.updatedFields || {},
      );
      if (
        updatedFields.includes('status') &&
        data.fullDocument.status == 3 &&
        data.fullDocument.marketingPlan
      ) {
        try {
          console.log(
            'watchToSelectDesign() > AI 시나리오 생성 시작 : ' +
              data.fullDocument._id,
          );

          const aiRequestId = data.fullDocument._id;
          const aiRequest = await AiRequest.findById(aiRequestId);

          aiRequest.status = 4;
          await aiRequest.save();

          const subtemplate = await Subtemplate.findById(
            data.fullDocument.subtemplateId,
          ).select('+sources');
          if (!subtemplate) throw { msg: 'SUBTEMPLATE NOT FOUND' };
          console.log(
            'watchToSelectDesign() > data.fullDocument.subtemplateId =',
            data.fullDocument.subtemplateId,
          );

          console.log(
            'watchToSelectDesign() > subtemplate.design =',
            subtemplate.design,
          );
          const design = await Design.findById(subtemplate.design);
          if (!design) throw { msg: 'DESIGN NOT FOUND.' };

          scenarioGen_v3.process(aiRequestId, design);
        } catch (error) {
          console.log('watchToSelectDesign() > error =', error);
          // const scenarioIndex = scenarioReqList.indexOf(data.fullDocument._id);
          // if (scenarioIndex != -1) scenarioReqList.splice(scenarioIndex, 1);
        }
      }
    }
  });
}

// 소스주입
function watchToAiCompletion() {
  AiRequest.watch(
    [
      {
        $match: {
          $and: [
            { 'fullDocument.requestType': 2 },
            { 'fullDocument.status': 5 },
            { 'fullDocument.subtemplateId': { $ne: null, $ne: '' } },
          ],
        },
      },
    ],
    { fullDocument: 'updateLookup' },
  ).on('change', async (data) => {
    if (data.operationType === 'update') {
      try {
        const subtemplate = await Subtemplate.findById(
          data.fullDocument.subtemplateId,
        );
        if (!subtemplate)
          throw 'SUBTEMPLATE NOT FOUND - ' + data.fullDocument._id;
        const design = await Design.findById(subtemplate.design);

        let sources = [];
        for (var i = 0; i < design.sources.length; i++) {
          var source1 = [];
          for (var j = 0; j < design.sources[i].source.length; j++) {
            source1.push(design.sources[i].source[j].sourceContent);
          }
          sources.push(source1);
        }
        subtemplate.sources = sources;
        subtemplate.workProgress = 0;
        await subtemplate.save();

        const success = await AutoMapper_v3.process_v2(data.fullDocument._id);
        console.log(
          `AUTO MAPPER ${success ? 'SUCCESS' : 'FAILED'} - ${
            data.fullDocument._id
          }`,
        );
      } catch (error) {
        console.error(`AUTO MAPPER ERROR - ${data.fullDocument._id}:`, error);
      } finally {
      }
    }
  });
}

function rateLimitHandler() {
  AiRequest.watch(
    [
      {
        $match: {
          $and: [
            {
              $or: [
                { 'fullDocument.requestType': 2 },
                { 'fullDocument.isNewScenario': true },
              ],
            },
            { 'fullDocument.status': { $lt: 0 } },
          ],
        },
      },
    ],
    { fullDocument: 'updateLookup' },
  ).on('change', async (data) => {
    const updatedFields = Object.keys(
      data.updateDescription.updatedFields || {},
    );
    let errCnt = 0;
    if (errorList && errorList.length > 0) {
      for (let err of errorList) {
        if (errorList.includes(data.fullDocument._id)) errCnt++;
      }
    }
    if (
      updatedFields.includes('status') &&
      data.fullDocument.status < 0 &&
      data.operationType === 'update'
    ) {
      const aiRequestId = data.fullDocument._id;
      const prevReq = await AiRequest.findById(aiRequestId);
      if (prevReq.failedAt && prevReq.failedAt.length > 2) {
        const errReqSubtemplate = await Subtemplate.findById(
          prevReq.subtemplateId,
        );
        errReqSubtemplate.fromAI = false;
        await errReqSubtemplate.save();
        prevReq.status = -6;
        await prevReq.save();
        console.log('AIREQUEST FAILED CERTAINLY');
      }
      if (errCnt <= 3 && data.fullDocument.status != -6) {
        console.log('ERROR HANDLER 시작');
        errorList.push(data.fullDocument._id);

        let waitTime = 5 * 1000;

        // RATE LIMIT ERROR 는 요청 즉시 에러를 출력하므로 시간차가 10초 이내면 1분 대기 처리
        if (
          prevReq.failedAt &&
          prevReq.failedAt.length > 0 &&
          (new Date() -
            new Date(prevReq.failedAt[prevReq.failedAt.length - 1])) /
            1000 >
            10
        ) {
          waitTime = 60 * 1000;
        }

        setTimeout(async () => {
          const erroredReq = await AiRequest.findById(aiRequestId);
          if (erroredReq) {
            console.log('RATE LIMIT HANDLER - ' + aiRequestId);
            let failedArr = !erroredReq.failedAt ? [] : erroredReq.failedAt;
            failedArr.push(new Date());
            erroredReq.failedAt = failedArr;
            if (erroredReq.status == -1) {
              erroredReq.personaFinished = false;
              erroredReq.featureFinished = false;
              erroredReq.hookingFinished = false;
              erroredReq.movingFinished = false;
              erroredReq.copyFinished = false;
              erroredReq.ctaFinished = false;
              erroredReq.promotionTitleInfoFinished = false;
              erroredReq.status = null;
              erroredReq.persona = [];
              erroredReq.feature = [];
              erroredReq.hooking = [];
              erroredReq.moving = [];
              erroredReq.copy = {};
              erroredReq.cta = {};
              erroredReq.promotionTitle = [];
              erroredReq.promotionDetail = [];
              erroredReq.scenario = {
                text: [],
                image: [],
                video: [],
              };
            } else if (erroredReq.status == -3) {
              erroredReq.status = 3;
              erroredReq.scenario = {
                text: [],
                image: [],
                video: [],
              };
            } else if (erroredReq.status == -5) {
              erroredReq.status = 5;

              const subtemplate = await Subtemplate.findById(
                erroredReq.subtemplateId,
              ).select('+sources');
              const design = await Design.findById(subtemplate.design);
              for (let i = 0; i < design.sources.length; i++) {
                for (let j = 0; j < design.sources[i].source.length; j++) {
                  if (design.sources[i].source[j].sourceType == 'T')
                    subtemplate.sources[i][j] = '';
                  else if (design.sources[i].source[j].sourceType == 'I')
                    subtemplate.sources[i][j] = null;
                  else if (design.sources[i].source[j].sourceType == 'V')
                    subtemplate.sources[i][j] = null;
                }
              }
              await subtemplate.save();
            }

            await erroredReq.save();
            errorList = errorList.filter((errReq) => errReq !== aiRequestId);

            console.log(`Updated status of AiRequest with ID ${aiRequestId}`);
          }
        }, waitTime);
      }
    }
  });
}
