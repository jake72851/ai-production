const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');
const Reservation = require('./reservation');

const uploadSchema = mongoose.Schema(
  {
    //등록 정보
    reservationId: {
      type: mongoose.Types.ObjectId,
      ref: 'Reservation',
      default: null,
    },
    //자동업로드의 ai 미승인용
    subtemplateId: {
      type: mongoose.Types.ObjectId,
      ref: 'Subtemplate',
      default: null,
    },
    //템플릿 정보
    resultVideo: {
      type: String,
      default: null,
    },
    //플랫폼 1: 페이스북 릴스, 2: 인스타 릴스, 3: 유튜브, 4: 틱톡, 5: 페이스북 스토리, 6: 인스타 스토리
    platform: {
      type: Number,
      default: 0,
    },
    // 카피 내용
    copy: {
      type: String,
      default: null,
    },
    category: {
      type: Number,
      // ['UNDEFINED',     101,       102,    103]
      // ['UNDEFINED', '프로모션', '제품 소개', '브랜딩']
    },
    toneAndManner: {
      // advanced options
      type: Array,
      // [UNDEFINED, 1,      2,        3,    4,        5,      6]
      // [UNDEFINED, 정보전달, 신뢰도 높은, 캐주얼, 전문성 있는, 재미있는, 대중적인]
    },
    templateRatio: {
      type: Number,
      // enum: ['all', '1x1', '9x16', '16x9', '4x5']
    },
    //진행 여부
    status: {
      type: Number,
      // 0 : 업로드 대기
      // 1 : 업로드 중
      // 2 : 업로드 완료
      // 3 : 업로드 실패
      // 4 : 업로드 부분 완료
      // 5 : 승인 취소
      // 6 : ai 승인 요청 // 자동업로드용
      // 7 : 영상 생성 대기 // 자동업로드용
      default: 0,
    },
    tags: {
      type: [String],
      default: [''],
    },
    templateType: { type: Array, default: [] },
    target: {
      gender: {
        type: Number,
        default: null,
        // [0,   1,   2]
        // [전체, 남성, 여성]
      },
      age: {
        type: Array,
        default: [],
        // [UNDEFINED, 1,   2,   3,    4,   5,   6]
        // [UNDEFINED, 10대, 20대, 30대, 40대, 50대, 60대 이상]
      },
    },
    copyDirection: {
      type: String,
      default: null,
    },
    uploadAt: {
      type: Date,
      required: false,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);

uploadSchema.plugin(mongoosePaginate);
uploadSchema.plugin(aggregatePaginate);

module.exports = mongoose.model('Upload', uploadSchema);