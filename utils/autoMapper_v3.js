const util = require('util');
const path = require('path');
const fs = require('fs');
const readdir = util.promisify(fs.readdir);
const unlink = util.promisify(fs.unlink);
const moment = require('moment');
const momentTz = require('moment-timezone');
const axios = require('axios');

const AiRequest = require('../models/aiRequest_v2');
const AwaitingPayment = require('../models/awaiting_payment');
const Design = require('../models/design');
const Subtemplate = require('../models/subtemplate');
const User = require('../models/user');
const Asset = require('../models/asset');

const gptAPI = require('./gptAPI');
const FreeImages = require('./freeImage');
const FreeVideos = require('./freeVideo');
const LambdaProcess = require('./lambda');

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
async function removeFiles(directory, fileName) {
  try {
    const files = await readdir(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);
      try {
        if (filePath.includes(fileName)) await unlink(filePath);
      } catch (error) {
        console.error(`Error deleting file ${filePath}: `, error);
        // 에러가 발생하더라도 다음 파일로 넘어갑니다.
      }
    }
    return 'DELETE FILE SUCCESS';
  } catch (error) {
    console.error('Error reading directory: ', error);
    return 'DELETE FILE ERROR';
  }
}
function removeSpecialCharacters(inputString) {
  let input = inputString;
  if (!input || input == '') input = 'undefined';
  // 특수 문자를 제외한 문자만 남기고 모두 제거
  return input.replace(/[^a-zA-Z0-9 ]+/g, '');
}

// 미디어소스 병렬처리 버전
exports.process_v2 = async (requestId) => {
  try {
    const aiRequest = await AiRequest.findById(requestId);
    if (!aiRequest) throw { msg: '잘못된 요청입니다.' };

    if (aiRequest.status < 0) {
      console.log('WAIT 1 MINUTE');
      return;
    }

    const subtemplate = await Subtemplate.findById(
      aiRequest.subtemplateId,
    ).select('+sources');
    if (!subtemplate) throw { msg: '프로젝트를 찾을 수 없습니다.' };

    const design = await Design.findById(subtemplate.design);
    if (!design) throw { msg: '디자인 템플릿을 찾을 수 없습니다.' };

    // 필요한 텍스트 갯수 확인과 소스주입용 텍스트 처리도 같이 진행
    let insertType = 'product'; // 카테고리 타입
    let constantType = 1400; // 카테고리의 상수 타입
    if (aiRequest.category === 101) {
      // 프로모션이면 변경
      insertType = 'promotion';
      constantType = 2400;
    }
    let needText = 0;
    const finalText = [];
    let tempNum = 0;
    for (let i = 0; i < design.sources.length; i++) {
      for (let j = 0; j < design.sources[i].source.length; j++) {
        if (design.sources[i].source[j].sourceType == 'T') {
          needText++;
          if (
            design.sources[i].source[j].sourceTextType[insertType] ===
            constantType
          ) {
            finalText.push(
              design.sources[i].source[j].sourceTextConstant[insertType],
            );
          } else {
            finalText.push(aiRequest.scenario.text[tempNum]);
            tempNum++;
          }
        }
      }
    }
    let needImage = design.needImage;
    let needVideo = design.needVideo;

    if (
      (needText > 0 && needText != finalText.length) ||
      (needImage > 0 && needImage != aiRequest.scenario.image.length) ||
      (needVideo > 0 && needVideo != aiRequest.scenario.video.length)
    ) {
      console.log('GENERATED SCENARIO LEN IS NOT ENOUGH - ' + aiRequest._id);
      aiRequest.scenario.text = [];
      aiRequest.scenario.image = [];
      aiRequest.scenario.video = [];
      if (aiRequest.status != -1) {
        aiRequest.status = -3;
      }
      await aiRequest.save();
      return;
    }

    console.log('소스 입력 시작');

    let textIdx = 0;
    let imageIdx = 0;
    let scenarioImageIdx = 0;
    let videoIdx = 0;
    let scenarioVideoIdx = 0;

    let imageList = [];
    if (design.needImage > 0) {
      if (aiRequest.images && aiRequest.images.length > 0) {
        for (let img of aiRequest.images) {
          imageList.push(img);
        }
      }
      if (imageList.length < design.needImage) {
        if (aiRequest.videoInsertType === 1) {
          for (let i = 0; i < design.needImage - imageList.length; i++) {
            imageList.push({
              url: 'FREEURL',
            });
          }
        } else {
          if (imageList.length == 0) {
            for (let i = 0; i < design.needImage; i++) {
              imageList.push({
                url: 'FREEURL',
              });
            }
          } else {
            let imgNum = 0;
            for (let i = 0; i < design.needImage * 2; i++) {
              if (imgNum >= aiRequest.images.length) imgNum = 0;
              imageList.push(aiRequest.images[imgNum]);
              imgNum++;
            }
          }
        }
      }
      imageList = shuffleArray(imageList);
      imageList = imageList.slice(design.needImage * -1);
    }
    console.log('autoMapper.process_v3() > imageList =', imageList);

    let videoList = [];
    if (design.needVideo > 0) {
      if (aiRequest.videos && aiRequest.videos.length > 0) {
        for (let vid of aiRequest.videos) {
          videoList.push(vid);
        }
      }
      if (videoList.length < design.needVideo) {
        if (aiRequest.videoInsertType === 1) {
          for (let i = 0; i < design.needVideo - videoList.length; i++) {
            videoList.push({
              url: 'FREEURL',
            });
          }
        } else {
          if (videoList.length == 0) {
            for (let i = 0; i < design.needVideo; i++) {
              videoList.push({
                url: 'FREEURL',
              });
            }
          } else {
            let movNum = 0;
            for (let i = 0; i < design.needVideo * 2; i++) {
              if (movNum >= aiRequest.videos.length) movNum = 0;
              videoList.push(aiRequest.videos[movNum]);
              movNum++;
            }
          }
        }
      }
      videoList = shuffleArray(videoList);
      videoList = videoList.slice(design.needVideo * -1);
    }
    console.log('autoMapper.process_v3() > videoList =', videoList);

    let mediaPromises = [];
    let innerSubtemplate = await Subtemplate.findById(
      aiRequest.subtemplateId,
    ).select('+sources');
    for (let i = 0; i < design.sources.length; i++) {
      for (let j = 0; j < design.sources[i].source.length; j++) {
        if (design.sources[i].source[j].sourceType == 'T') {
          // TEXTS
          if (finalText && finalText.length > 0) {
            innerSubtemplate.sources[i][j] = finalText[textIdx];
          } else {
            innerSubtemplate.sources[i][j] = ' ';
          }
          textIdx++;
        } else if (design.sources[i].source[j].sourceType == 'I') {
          // IMAGES
          let width = design.sources[i].source[j].sourceWidth;
          let height = design.sources[i].source[j].sourceHeight;

          let requestURL = '';
          let assetId = '';

          if (
            imageList.length <= imageIdx ||
            imageList[imageIdx].url == '' ||
            imageList[imageIdx].url == 'FREEURL'
          ) {
            // 이미지가 없을때, 검색하여 무료이미지 업로드
            let freeImageInfo = await FreeImages.getImages_v2(
              `${removeSpecialCharacters(
                aiRequest.scenario.image[scenarioImageIdx],
              )}_${Date.now()}`,
              aiRequest.scenario.image[scenarioImageIdx],
              aiRequest.userId,
            );

            if (!freeImageInfo.isSuccess || freeImageInfo.originalUrl == '') {
              const keywordGenArr = await gptAPI.keywordGenGPT(
                aiRequest.scenario.image[scenarioImageIdx],
              );
              console.log('IMAGE ALTER KEYS : ' + keywordGenArr);
              if (keywordGenArr && keywordGenArr.length == 3) {
                for (let i = 0; i < keywordGenArr.length; i++) {
                  let key = keywordGenArr[i];
                  key = removeSpecialCharacters(key);
                  freeImageInfo = await FreeImages.getImages_v2(
                    `${key}_${Date.now()}`,
                    key,
                    aiRequest.userId,
                  );
                  if (freeImageInfo.isSuccess) break;
                }
              }
            }

            if (freeImageInfo.isSuccess && freeImageInfo.originalUrl != '')
              requestURL = freeImageInfo.originalUrl;
            else {
              console.log('FAILED IMAGE PROCCESS');
              throw ''; // -5 처리 필요
            }
          } else {
            requestURL = imageList[imageIdx].url;
            assetId = imageList[imageIdx].assetId; // assetId 추가
          }

          mediaPromises.push({
            i: i,
            j: j,
            type: 'I',
            width: width,
            height: height,
            url: requestURL,
            assetId: assetId, // assetId 추가
            needRmbg: design.sources[i].source[j].removeBackgroundContent
              ? true
              : false,
          });

          imageIdx++;
          scenarioImageIdx++;
        } else if (design.sources[i].source[j].sourceType == 'V') {
          // VIDEOS
          let requestURL = '';

          if (
            videoList.length <= videoIdx ||
            videoList[videoIdx].url == '' ||
            videoList[videoIdx].url == 'FREEURL'
          ) {
            // 영상이 없을때, 검색하여 무료영상 업로드
            let freeVideoInfo = await FreeVideos.getVideos(
              `${aiRequest._id}_${scenarioVideoIdx}`,
              aiRequest.scenario.video[scenarioVideoIdx],
            );
            if (
              !freeVideoInfo ||
              !freeVideoInfo.uploadedUrl ||
              freeVideoInfo.uploadedUrl == ''
            ) {
              const keywordGenArr = await gptAPI.keywordGenGPT(
                aiRequest.scenario.video[scenarioVideoIdx],
              );
              console.log('VIDEO ALTER KEYS : ' + keywordGenArr);
              if (keywordGenArr && keywordGenArr.length == 3) {
                for (let i = 0; i < keywordGenArr.length; i++) {
                  let key = keywordGenArr[i];
                  key = removeSpecialCharacters(key);
                  freeVideoInfo = await FreeVideos.getVideos(
                    `${key}_${Date.now()}`,
                    key,
                  );
                  if (
                    freeVideoInfo &&
                    freeVideoInfo?.uploadedUrl &&
                    freeVideoInfo.uploadedUrl != ''
                  )
                    break;
                }
              }
            }
            if (
              freeVideoInfo &&
              freeVideoInfo?.uploadedUrl &&
              freeVideoInfo.uploadedUrl != ''
            )
              requestURL = freeVideoInfo.uploadedUrl;
          } else {
            requestURL = videoList[videoIdx].url;
          }

          mediaPromises.push({
            i: i,
            j: j,
            type: 'V',
            duration: design.sources[i].source[j].sourceVideoTime,
            url: requestURL,
          });
          videoIdx++;
          scenarioVideoIdx++;
        }
      }
    }
    console.log(
      'autoMapper.process_v3() > innerSubtemplate =',
      innerSubtemplate,
    );

    if (aiRequest.isNewScenario) {
      if (
        aiRequest.finishedSources &&
        aiRequest.finishedSources[0] &&
        aiRequest.finishedSources[0].length > 0
      ) {
        for (let i = 0; i < design.sources.length; i++) {
          for (let j = 0; j < design.sources[i].source.length; j++) {
            if (design.sources[i].source[j].sourceType != 'T') {
              innerSubtemplate.sources[i][j] =
                aiRequest.finishedSources[aiRequest.finishedSources.length - 1][
                  i
                ][j];
            }
          }
        }
      }
    }
    
    for(let i = 0; i < design.sources.length; i++) {
      for(let j = 0; j < design.sources[i].length; j++) {
        if(design.sources[i].source[j].sourceType == "T") {
          if(innerSubtemplate.sources[i][j] == "") innerSubtemplate.sources[i][j] == " "
        }
      }  
    }

    innerSubtemplate.workProgress = await getWorkProcess(innerSubtemplate);
    await innerSubtemplate.save();

    // 병렬처리
    if (mediaPromises.length > 0 && innerSubtemplate.workProgress < 100) {
      console.log('START PARELLEL PROCESS');

      const processedPromises = mediaPromises.map((work) =>
        mediaProcess(work, aiRequest.userId, aiRequest.subtemplateId),
      );
      let mediaProcessResult = await Promise.all(processedPromises);
      console.log(
        'mediaProcessResult (isSuccess? true/false) : ' +
          JSON.stringify(mediaProcessResult),
      );

      if (mediaProcessResult.includes(false))
        throw 'MEDIA PROGRESS FAILED, RETRY';
    }

    aiRequest.status = 6;
    let resultSubtemplate = await Subtemplate.findById(
      aiRequest.subtemplateId,
    ).select('+sources');
    if (resultSubtemplate.workProgress < 100) {
      console.log('MEDIA PROCESS ERROR - NEW MEDIA TRY');
      aiRequest.status = -5;
      console.log(`ERROR IN - ${aiRequest._id}`);
    } else {
      console.log('AUTO PROJECT SOURCE MAPPING FINISHED');
    }

    if (!aiRequest.finishedSources) aiRequest.finishedSources = [];
    aiRequest.finishedSources.push(resultSubtemplate.sources);

    const resultAiRequest = await aiRequest.save();

    if (resultSubtemplate.workProgress == 100 && aiRequest.autoRender) {
      resultSubtemplate.status = 1;

      const renderQueue = await axios.get(
        'http://52.79.237.149:4002/render-queue',
      );

      const awaitingProjects = await Subtemplate.find({ status: -1 });
      let isExceedRender = false;
      let concurrentRenderLimit = 1; // 사용자 당 동시 렌더링 가능 개수 => 추후에 결제시 증가 가능
      if (resultSubtemplate.userId == '5eb4c8556db0575296d9a4f5')
        concurrentRenderLimit = 9999; // 테스트 계정은 무한대로 동시렌더 가능 처리

      if (
        resultSubtemplate.status == 1 &&
        resultSubtemplate.userId != '5eb4c8556db0575296d9a4f5' &&
        resultSubtemplate.userId != '5ef98cde9921231409686b2d'
      ) {
        // 요청받은 프로젝트의 사용자가 렌더 요청한 것중에 아직 완료되지 않은 것이 있는지 확인하는 코드
        const alreadyRenderRequested = await Subtemplate.find({
          $and: [
            { status: { $in: [-1, 1, 2] } },
            { userId: resultSubtemplate.userId },
          ],
        });

        resultSubtemplate.renderProgress = 0;
        if (
          alreadyRenderRequested &&
          alreadyRenderRequested.length >= concurrentRenderLimit
        ) {
          console.log(
            '이미 해당 사용자의 서브템플릿 렌더링 중 -> 대기 status -1 부여',
          );
          resultSubtemplate.status = -1; // 동시렌더 제한 상태 값 -1 => 해소는 렌더큐 서버에서 처리
        } else if (renderQueue.length >= 11 || awaitingProjects.length > 0) {
          resultSubtemplate.status = -1; // 렌더 대기 상태 값 -1 => 해소는 렌더큐 서버에서 처리

          if (awaitingProjects.length > 20) {
            // 렌더 과부하 제한 상태 값 -1 => 해소는 렌더큐 서버에서 처리
            console.log(
              '렌더 과부화 (렌더큐 가득참 && 대기열 길이가 15 초과) -> 대기해야 한다는 메시지 및 사용자 이메일 전달',
            );
            isExceedRender = true;
          }
        }
      }
    }
    let lastSubtemplate = await resultSubtemplate.save();

    await removeFiles('freeImages', `${lastSubtemplate._id}`);
    await removeFiles('freeUploadList', `${lastSubtemplate._id}`);
    await removeFiles('convertedImages', `${lastSubtemplate._id}`);

    return true;
  } catch (error) {
    console.log(error);
    const aiRequest = await AiRequest.findById(requestId);
    aiRequest.status = -5;
    console.log(`ERROR IN - ${aiRequest._id}`);
    await aiRequest.save();
    return false;
  }
};

async function getWorkProcess(subtemplate) {
  try {
    let totalCnt = 0;
    let workedCnt = 0;
    for (let i = 0; i < subtemplate.sources.length; i++) {
      totalCnt += subtemplate.sources[i].length;
      for (let j = 0; j < subtemplate.sources[i].length; j++) {
        if (subtemplate.sources[i][j] && subtemplate.sources[i][j] != '')
          workedCnt++;
      }
    }
    let percent = totalCnt != 0 ? parseInt((workedCnt / totalCnt) * 100) : 0;

    return percent;
  } catch (error) {
    console.log(`ERR IN GETTING WORKPROCESS : ${error}`);
    return 0;
  }
}

async function mediaProcess(workData, userId, subtemplateId) {
  try {
    if (
      !subtemplateId ||
      subtemplateId == '' ||
      !workData?.url ||
      workData.url == ''
    )
      throw 'MEDIA PROCESS - URL NOT DEFINED';

    let isSuccess = false;
    let sourceIdx_i = workData.i;
    let sourceIdx_j = workData.j;
    let type = workData.type;
    let url = workData.url;
    let assetId = workData.assetId;

    if (type == 'I') {
      let requestUrl = workData.url;
      console.log('IMAGE PROCESS REQUEST URL : ' + requestUrl);

      let convetedInfo = {
        isSuccess: false,
        data: {
          url: requestUrl,
        },
      };
      if (!requestUrl.includes('.png')) {
        convetedInfo = await LambdaProcess.imageConvertLambda(
          requestUrl,
          userId && userId != '' ? userId : 'undefind',
        );
      } else {
        convetedInfo.isSuccess = true;
        convetedInfo.data.convertedExt = 'png';
      }
      requestUrl = convetedInfo?.data?.url;

      if (workData.needRmbg) {
        // 이미지 배경 제거 필요
        let rmbgResult = await LambdaProcess.rembgLambda(requestUrl, userId);
        if (rmbgResult.isSuccess) requestUrl = rmbgResult.data.url;
      }

      console.log(
        'mediaProcess() >convetedInfo.data.url =',
        convetedInfo.data.url,
      );
      if (
        convetedInfo.isSuccess &&
        convetedInfo.data &&
        convetedInfo.data.url != ''
      ) {
        // asset 처리 추가
        let asset = null;
        if (assetId != '') {
          const assetInfo = await Asset.findById(assetId);
          if (
            assetInfo.productBoundStatus == 1 &&
            assetInfo.productBounds &&
            assetInfo.productBounds.left
          ) {
            asset = assetInfo.productBounds;
          }
        }
        // let resizeInfo = await LambdaProcess.imageProcessLambda(
        //   convetedInfo.data.url,
        //   userId,
        //   workData.width,
        //   workData.height
        // );
        let resizeInfo = await LambdaProcess.imageTargetCrop(
          convetedInfo.data.url,
          userId,
          workData.width,
          workData.height,
          asset,
        );
        if (
          resizeInfo.isSuccess &&
          resizeInfo.data &&
          resizeInfo.data.url != ''
        ) {
          requestUrl = resizeInfo.data.url;
        } else {
          throw 'IMAGE PROCCESS LAMBDA FAILED';
        }
      } else {
        throw 'IMAGE CONVERT LAMBDA FAILED';
      }

      url = requestUrl;
      isSuccess = true;
    } else if (type == 'V') {
      let requestUrl = workData.url;
      console.log('VIDEO PROCESS REQUEST URL : ' + requestUrl);

      let proccessedVideoInfo = await LambdaProcess.videoProcessLambda(
        requestUrl,
        workData.duration,
      );
      if (
        proccessedVideoInfo.isSuccess &&
        proccessedVideoInfo?.data?.processedUploadURL &&
        proccessedVideoInfo.data.processedUploadURL != ''
      ) {
        requestUrl = proccessedVideoInfo.data.processedUploadURL;
      } else {
        throw 'VIDEO PROCESS LAMBDA FAILED';
      }

      url = requestUrl;
      isSuccess = true;
    }

    if (isSuccess && url && url != '') {
      const subtemplate = await Subtemplate.findById(subtemplateId).select(
        '+sources',
      );
      if (!subtemplate) throw 'MEDIA PROCESS FAILED - SUBTEMPLATE NOT FOUND';

      subtemplate.sources[sourceIdx_i][sourceIdx_j] = url;
      subtemplate.workProgress = await getWorkProcess(subtemplate);
      await subtemplate.save();
    }

    return isSuccess;
  } catch (error) {
    console.log(`MEDIA PARELLEL PROCESS ERROR - ${error}`);
    return false;
  }
}
