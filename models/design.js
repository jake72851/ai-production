const mongoose = require('mongoose');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

const designSchema = mongoose.Schema(
  {
    //템플릿 고유 아이디
    _id: String,
    listIndex: {
      type: Number,
      default: -1,
    },
    //템플릿 제목
    temTitle: {
      type: String,
      default: null,
    },
    //제작자
    temAuthor: {
      type: String,
      default: null,
    },
    //가격
    temPrice: {
      type: Number,
      default: null,
      index: true,
    },
    //썸네일
    temThumbnail: {
      type: String,
      default: null,
    },
    temThumbnailVideo: {
      type: String,
      default: null,
    },
    //템플릿 내용
    temContent: {
      type: String,
      default: null,
    },
    //영상길이
    videoDuration: {
      type: Number,
      default: null,
      index: true,
    },
    //필요한 비디오 갯수
    needVideo: {
      type: Number,
      default: null,
      index: true,
    },
    //필요한 이미지 갯수
    needImage: {
      type: Number,
      default: null,
      index: true,
    },
    //필요한 텍스트 갯수

    //프리뷰 영상 url
    temPreviewVideo: {
      type: String,
      default: null,
    },
    //프리뷰를 뽑아내려는 프레임 배열
    previewFrame: {
      _id: false,
      type: [Number],
      default: null,
    },
    //템플릿 컬러 - 메인,서브,텍스트
    temColor: {
      _id: false,
      type: [String],
      default: [null, null, null],
    },
    //음악 정보
    bgm: {
      type: String,
      ref: 'Music',
      default: null,
    },
    //전체-0, 카페&레스토랑 - 1. 뷰티&패션 - 2, 기업(IT) - 3, 예술 - 4, 여행 - 5, 개인 - 6, 액티비티 - 7, 이벤트 - 8, 이커머스 - 9, 스토리텔링 -10, 타이포- 11, 상품소개 -12, 포스터 -13, 기타-14
    categorize: {
      type: Array,
      index: true,
      // enum: ['all', 'cafe', 'beauty', 'company', 'arts', 'travel', 'individual', 'activity', 'events', 'ecommerce', 'storytelling', 'typo', 'product', 'poster', 'etc']
    },
    //전체 - 0, 따뜻한 - 1, 차가운  - 2, 감성적인 - 3, 차분한 - 4, 화려한 - 5,모던심플 - 6, 실험적인 - 7, 입체적인 - 8
    style: {
      type: Array,
      index: true,
      // enum: ['all', 'Cute', 'Simple', 'Retro', 'Comfortable', 'Luxurious', 'Innovative', 'Abstract', 'Professional']
    },
    tempo: {
      type: Number,
      index: true,
      // enum: ['느린','중간','빠른']
    },
    //전체 - 0, 1:1 - 1, 9:16 - 2, 16:9 - 3, 4:5 - 4
    templateRatio: {
      type: Number,
      index: true,
      // enum: ['all', '1x1', '9x16', '16x9', '4x5']
    },
    //프로젝트 파일 경로
    projectPath: {
      type: String,
      default: null,
    },
    group: {
      type: String,
      default: 'test1',
      index: true,
    },
    languageCode: {
      type: String,
      default: 'ko',
      index: true,
    },
    usedCnt: {
      type: Number,
      default: 0,
    },
    tags: {
      type: Array,
    },
    fhdPath: {
      type: String,
    },
    //템플릿 소스
    sources: {
      type: [
        {
          _id: false,
          //에디와의 통신위하여
          doubleCheck: [Number],
          //씬 번호
          sceneIndex: {
            type: Number,
            default: null,
          },
          //씬 이미지
          sceneImage: {
            type: String,
            default: null,
          },
          //
          source: [
            {
              _id: false,
              sourceType: {
                type: String,
                enum: ['V', 'I', 'T'],
              },
              iconArea: {
                type: [Number],
                // default: [null, null],
                _id: false,
              },
              thumbnailArea: {
                type: [Number],
                // default: [null, null],
                _id: false,
              },
              defaultContent: {
                type: String,
              },
              removeBackgroundContent: {
                type: Boolean,
              },
              sourceContent: {
                type: String,
                default: null,
              },
              sourceTextLength: {
                type: [Number],
                //default: [null, null, null]
              },
              //수정해야될때 auto-upload도 봐야된다
              sourceHeight: {
                type: Number,
                default: null,
              },
              sourceWidth: {
                type: Number,
                default: null,
              },
              sourceVideoTime: {
                type: Number,
                default: null,
              },
              sourceArea: {
                type: [[Number]],
                // default: [[null, null],[null, null],[null, null],[null, null]]
              },

              sourceTextType: {
                product: {
                  type: Number,
                  // 1100 - 제품명, 1200 - 제품 가격, 1300 - 제품 특징, 1400 - 상수(^), 1500 - CTA문구, 1600 - 캐치프레이즈
                  // 제품 특징 a : 1310 - a (15자 이내), 1311 - a 설명 short (15자 내외), 1312 - a 설명 medium (30자 내외)
                  // 제품 특징 b : 1320 - b (15자 이내), 1321 - b 설명 short (15자 내외), 1322 - b 설명 medium (30자 내외)
                  // 제품 특징 c : 1330 - c (15자 이내), 1331 - c 설명 short (15자 내외), 1332 - c 설명 medium (30자 내외)
                  // 제품 특징 d : 1340 - d (15자 이내), 1341 - d 설명 short (15자 내외), 1342 - d 설명 medium (30자 내외)
                  // 제품 특징 e : 1350 - e (15자 이내), 1351 - e 설명 short (15자 내외), 1352 - e 설명 medium (30자 내외)
                  // 캐치프레이즈 질문형 : 1610 - short (15자 내외), 1611 - medium (30자 내외)
                  // 캐치프레이즈 일반형 : 1620 - short (15자 내외), 1621 - medium (30자 내외)
                },
                promotion: {
                  type: Number,
                  // 2100 - 제품명, 2200 - 제품 가격, 2300 - 제품 특징, 2400 - 상수(^), 2500 - CTA문구, 2600 - 프로모션 캐치프레이즈, 2700 - 프로모션 내용, 2800 - 할인금액, 2900 - 할인율
                  // 2310 - 제품 특징, 2311 - 설명 short (15자 내외), 2312 - 설명 medium (30자 내외)
                },
              },
              sourceTextNumber: {
                // 텍스트가 분절해서 들어가야하는 경우에는 라벨링 뒤에 1, 2, 3 등을 붙여서 한 덩어리라는걸 표현
                // 0 이면 단일 텍스트
                promotion: {
                  type: Number,
                },
                product: {
                  type: Number,
                },
              },
              sourceTextConstant: {
                promotion: {
                  type: String,
                  default: null, // 상수인 경우만 존재
                },
                product: {
                  type: String,
                  default: null, // 상수인 경우만 존재
                },
              },
              sourceTextNumberTotal: {
                // 분절된 텍스트의 총 갯수
                promotion: {
                  type: Number,
                },
                product: {
                  type: Number,
                },
              },
            },
          ],
        },
      ],
    },
  },
  {
    versionKey: false,
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

designSchema.plugin(aggregatePaginate);

module.exports = mongoose.model('Design', designSchema);
