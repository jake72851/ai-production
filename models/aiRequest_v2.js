const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Subtemplate = require('./subtemplate');
const Product = require('./product');

const aiRequestV2Schema = mongoose.Schema(
  {
    originId: {
      type: mongoose.Types.ObjectId,
    },
    // 유저 아이디
    userId: {
      type: String,
      // required: true
    },
    // 요청 URL
    url: {
      type: String,
      default: '',
    },
    // 무료 이미지 검색용 키워드 from GPT
    keyword: {
      type: String,
      default: '',
    },
    usedPoint: {
      type: Number,
      default: 1,
    },
    // 유저 입력시 사용
    name: {
      type: String,
      default: '',
    },
    // 유저 입력시 사용
    brief: {
      type: String,
      default: '',
    },
    // 유저 입력시 사용
    detail: {
      type: String,
      default: '',
    },
    // 유저 입력시 사용 - 제품정보로 시작하기
    reviews: {
      type: Array,
    },
    // 유저 입력시 사용 - 제품정보로 시작하기
    priceInfo: {
      originalPrice: {
        type: Number,
      },
      discountPrice: {
        type: Number,
      },
      currency: {
        type: String,
      },
    },
    category: {
      type: Number,
      // ['UNDEFINED',     101,       102,    103]
      // ['UNDEFINED', '프로모션', '제품 소개', '브랜딩']
    },
    target: {
      // advanced options
      gender: {
        type: Number,
        // [0,   1,   2]
        // [전체, 남성, 여성]
      },
      age: {
        type: Array,
        // [0,   1,    2,    3,   4,   5,    6]
        // [전체, 10대, 20대, 30대, 40대, 50대, 60대 이상]
      },
    },

    // ai 추천 이미지 from crawler 또는 유저가 업로드한 이미지
    images: {
      type: Array,
      default: [], // type 이 2 일때 객체 배열 형태 ex) { assetId: Asset._id, url: String }
    },
    videos: {
      type: Array,
      default: [], // type 이 2 일때 객체 배열 형태 ex) { assetId: Asset._id, url: String }
    },
    subtemplateId: {
      type: mongoose.Types.ObjectId,
      ref: 'Subtemplate',
      default: null,
    },
    product: {
      type: mongoose.Types.ObjectId,
      ref: 'Product',
      default: null,
    },

    status: {
      type: Number,
      default: null,
      // null, 0 : 광고기획 시작
      // 1 : persona 기획 완료 및 제품특징, 고객 후킹 포인트, 고객 감동 포인트, 카피 생성 시작
      // 2 : 광고 기획 전체 완료 (persona 기획 완료 및 제품특징, 고객 후킹 포인트, 고객 감동 포인트, 카피 생성)
      // 3 : 시나리오 생성 완료 (디자인 선택 여부는 subtemplateId 로 체크)
      // 4 : 미디어 소스 삽입 완료(서브템플릿 유저소스 입력 자동화 처리 중)
      // 5 : 완료
      // -1: ERROR 로 1분 대기 상태 (1분 대기 후 다시 GPT status null 부터 다시 시작) | 시니리오 실패
      // -2: 완전히 실패함
      // -3: 시나리오 부족 실패
      // -5: 미디어 처리 실페
    },

    lang: {
      type: String,
      default: 'en',
    },
    requestType: {
      type: Number,
      // 1: GPT 플러그인 ( 적용 예정 )
      // 2: 제품 정보로 시작하기
      // 3: URL ( 예정 )
    },
    autoRender: {
      // 나가서 기다릴시
      type: Boolean,
      default: false,
    },
    failedAt: {
      type: Array,
      default: [],
    },

    productTrans: {
      type: String,
    },

    persona: {
      type: Array,
      default: [],
    },
    personaFinished: {
      type: Boolean,
      default: false,
    },
    userPersona: {
      // 사용자가 직접 기획으로 페르소나 적용시
      type: String,
      default: null,
    },
    feature: {
      type: Array,
      default: [],
    },
    featureFinished: {
      type: Boolean,
      default: false,
    },
    hooking: {
      type: Array,
      default: [],
    },
    hookingFinished: {
      type: Boolean,
      default: false,
    },
    moving: {
      type: Array,
      default: [],
    },
    movingFinished: {
      type: Boolean,
      default: false,
    },

    promotionTitle: {
      type: Array,
      default: [],
    },
    promotionDetail: {
      type: Array,
      default: [],
    },
    promotionTitleInfoFinished: {
      type: Boolean,
      default: false,
    },

    copy: {
      type: Object,
      default: null,
    },
    copyFinished: {
      type: Boolean,
      default: false,
    },

    cta: {
      type: Object,
      default: null,
    },
    ctaFinished: {
      type: Boolean,
      default: false,
    },

    // front ai 기획서 보이기용
    marketingPlan: {
      type: Boolean,
      default: false,
    },

    isNewScenario: {
      // 시나리오 생성 버튼 클릭시 true
      type: Boolean,
      default: false,
    },
    scenario: {
      text: {
        type: Array,
        default: [],
      },
      image: {
        type: Array,
        default: [],
      },
      video: {
        type: Array,
        default: [],
      },
    },
    // copy, tags 생성 시 가격 포함 옵션
    includePrice: { type: Boolean, default: true },

    highlight: {
      type: Number,
      // 0 : 사진강조 안함, 1 : 사진강조
    },
    // 프로모션 정보
    promotionInfo: {
      type: String,
    },
    // 프로모션 할인가격
    promotionPrice: {
      type: Number,
    },
    // 프로모션 할인율
    promotionPricePercent: {
      type: String,
    },
    videoInsertType: {
      type: Number,
      // 1 - 무료이미지, 영상 사용 | 2 - 직접등록한 이미지, 영상만 사용
    },
    finishedSources: {
      type: Array,
      // GPT로 생성하고 적용한 서브템플릿 소스 배열 [[첫번째 시도로 만든 것], [두번째 시도로 만든 것], ... [N번째 시도로 만든 것]]
    },
  },
  {
    versionKey: false,
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

aiRequestV2Schema.plugin(mongoosePaginate);

module.exports = mongoose.model('Airequests_v2', aiRequestV2Schema);
