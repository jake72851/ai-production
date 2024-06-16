const mongoose = require('mongoose');
const moment = require('moment');
const tz = require('moment-timezone');
moment.tz.setDefault('Asia/Seoul');

const userSchema = mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    //유저 고유 아이디
    userUid: {
      type: String,
      trim: true,
      required: true,
    },
    //유저 이름
    userName: {
      type: String,
      trim: true,
      default: null,
    },
    //유저 이메일
    userEmail: {
      type: String,
    },
    //패스워드
    password: {
      type: String,
      default: null,
      select: false,
    },
    //유저 휴대폰 번호
    userPhoneNumber: {
      type: String,
      default: null,
    },
    //유저 디바이스 번호
    FCMToken: {
      type: String,
      default: null,
    },
    //푸시 여부
    push: {
      type: Boolean,
      default: true,
    },
    //유저의 그룹 형태
    group: {
      type: String,
      default: 'vplate',
    },
    //가입 경로
    channel: {
      type: String,
      default: null,
    },
    //소셜 가입 여부
    social: {
      facebook: {
        type: String,
        default: null,
      },
      google: {
        type: String,
        default: null,
      },
    },
    //결제 정보
    payment: {
      //빌링키
      billingKey: {
        type: String,
        default: null,
        select: false,
      },
      paypleBillingKey: {
        type: String,
        default: null,
        select: false,
      },
      reserveId: {
        type: String,
        default: null,
        select: false,
      },
      // 요금제 정보 - invoice plan type 과 별개임!!!
      // 단건 - [0]
      // 베이직 - [1]
      // 스탠다드 - [2]
      // 엔터프라이즈 - [3]
      planType: {
        type: Number,
        default: 0,
      },
      //결제 유형 - 건당 / 월간 / 연간
      period: {
        type: Number,
        default: 0,
      },
      //상세정보 - 건당 결제, 베이직, 스탠다드, 프로 등
      detail: {
        type: String,
        default: null,
      },
      //월간 시나리오 생성 가능 횟수
      monthlyScenarioGen: {
        type: Number,
        default: 3
      },
      resetScenarioDate: {
        type: Date
      },
      //admin 여부
      admin: {
        type: Boolean,
        default: false,
      },
      //구독 여부
      subscription: {
        type: Number,
        default: 0,
      },
      paymentType: {
        type: String,
        default: 'payple',
      },
      //구독 시작 날짜
      subscriptionStart: {
        type: Date,
        default: null,
      },
      //구독 다음 날짜
      subscriptionNext: {
        type: Date,
        default: null,
      },
      //구독 만료 날짜
      subscriptionExpire: {
        type: Date,
        default: null,
      },
      // 업로드 가능 날짜
      uploadExpire: {
        type: Date,
        default: null,
      },
      // invoice method 와 같은 값.
      method: {
        type: String,
        default: null,
      },
      downgradeId: {
        type: mongoose.Types.ObjectId,
        ref: 'Invoice',
        default: null,
      },
      // 구독 시 청구서와 매칭.
      // 구독 관련 데이터는 청구서에서 가져오도록 나중에 변경.
      invoiceId: {
        type: mongoose.Types.ObjectId,
        ref: 'Invoice',
      },
    },
    render: {
      // 무료회원 렌더 횟수(타임스탬프 배열)
      type: Array,
      default: [],
    },
    // 시나리오 횟수 사용량 (무료 3회/월)
    usedScenarioGen: {
      type: Number,
      default: 0
    },
    // CRM 스프레드 시트 참조
    marketing: {
      firstCRM: {
        type: Boolean,
        default: false,
      },
      secondCRM: {
        type: Boolean,
        default: false,
      },
      thirdCRM: {
        type: Boolean,
        default: false,
      },
      fourthCRM: {
        type: Boolean,
        default: false,
      },
    },
    // 가입 전 유입 경로
    inflow: {
      type: Array,
      default: [],
    },
    //유저 생년 월일
    userBirth: {
      type: String,
      default: null,
    },
    //유저 성별
    userSex: {
      type: String,
      default: null,
    },
    business: {
      //워터마크
      watermark: {
        type: String,
        default: null,
      },
      //회사 이름
      name: {
        type: String,
        default: null,
      },
      //회사 정보
      content: {
        type: String,
        default: null,
      },
      //회사 주소
      address: {
        type: String,
        default: null,
      },
      //사업 종류
      category: {
        type: String,
        default: null,
      },
      //사업 형태
      form: {
        type: String,
        default: null,
      },
      //사업 부서
      department: {
        type: String,
        default: null,
      },
      //사업 예산
      budget: {
        type: String,
        default: null,
      },
    },
    externals: {
      cafe24: {
        mall_id: {
          type: String,
          dufalt: null,
        },
        version: {
          type: String,
          dufalt: null,
        },
        access_token: {
          type: String,
          dufalt: null,
        },
        refresh_token: {
          type: String,
          dufalt: null,
        },
        redirect_uri: {
          type: String,
          dufalt: null,
        },
      },
      naver: {
        iss: {
          type: String,
        },
        sub: {
          type: String,
        },
        exp: {
          type: Number,
        },
        iat: {
          type: Number,
        },
        solutionId: {
          type: String,
        },
        accountId: {
          type: String,
        },
      },
      colosseum: {
        landedAt: {
          type: Date,
        },
      },
      vplate: {
        createdAt: {
          type: Date,
        },
      },
      makeshop: {
        landedAt: {
          type: Date,
        },
      },
      godomall: {
        landedAt: {
          type: Date,
        },
      },
    },
    lastRefreshToken: {
      type: String,
      default: null,
    },
    ref: {
      // 프로모션 정기결제 할인 적용 및 유입 시간 확인
      landedAt: {
        type: Date,
        default: null,
      },
      domain: {
        type: String,
        default: '',
      },
      status: {
        type: Number,
        default: -1,
        // 0: 사용전(프로모션 대상자), 1: 사용중(프로모션으로 정기결제 진행중), 2: 프로모션 사용완료(프로모션 정기결제 후 만료), -1: 프로모션 비대상자
      },
    },
    ip: {
      type: String,
    },
    countryCode: {
      type: String,
    },
    hideUntil: {
      type: Date,
    },
    //sns 계정연동
    snsAccount: {
      facebook: {
        tokenInfo: {
          type: Object,
        },
        tokenDebugInfo: {
          type: Object,
        },
        userInfo: {
          type: Object,
        },
        pageInfo: {
          type: Array,
        },
        // 유저가 선택한 페이지
        userSelectPage: {
          type: Array,
        },
      },
      instagram: {
        accountInfo: {
          type: Array,
        },
        // 유저가 선택한 계정
        userSelectAccount: {
          type: Array,
        },
        tokenInfo: {
          type: Object,
        },
        tokenDebugInfo: {
          type: Object,
        },
        userInfo: {
          type: Object,
        },
        pageInfo: {
          type: Array,
        },
        // 유저가 선택한 인스타그램 계정과 연동된 페이지
        userSelectPage: {
          type: Array,
        },
      },
      youtube: {
        tokenInfo: {
          type: Object,
        },
        userInfo: {
          type: Object,
        },
        channelInfo: {
          type: Array,
        },
        // 유저가 선택한 채널
        userSelectChannel: {
          type: Array,
        },
      },
      tiktok: {
        tokenInfo: {
          type: Object,
        },
        userInfo: {
          type: Object,
        },
      },
    },

    // 추가 플랫폼 요청
    prePlatform: {
      type: Array,
    },
  },
  {
    versionKey: false,
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

module.exports = mongoose.model('User', userSchema);