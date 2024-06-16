const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const assetSchema = mongoose.Schema(
  {
    userId: {
      // user._id
      type: String,
      required: true,
    },
    originalUrl: {
      // Original version S3 URL
      type: String,
      required: true,
    },
    convertedUrl: {
      // Converted version(image -> png, video -> mp4) S3 URL
      type: String,
      default: null,
    },
    type: {
      type: String,
      required: true,
      // [image, video]
    },
    name: {
      type: String,
      required: true,
    },
    size: {
      // MB
      type: Number,
      require: true,
    },
    extention: {
      type: String,
      required: true,
      // [png, jpg, jpeg, webp, mp4]
    },
    resolution: {
      type: String,
      required: true,
    },
    duration: {
      // Video 인 경우
      type: String,
    },
    status: {
      type: Number,
      default: 0,
      // 0: 원본 업로드 완료, 1: 확장자 변경됨(원본이 적합한 확장자인경우 포함), -1: 실패
    },
    // google vision api 제품 크롭위치
    productBounds: {
      type: Object,
    },
    //  google vision api 제품 인식 여부 - 0 제품인식 적용전, 1 제품인식, 2 제품인식 불가, 3 제품에 텍스트가 방해, -1 람다 오류
    productBoundStatus: {
      type: Number,
      default: 0,
    },
    // vision api 제품 인식 정보
    productInfo: {
      type: Array,
    },
    // vision api 텍스트 인식 정보
    productTextInfo: {
      type: Array,
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
  }
);

assetSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Asset", assetSchema);
