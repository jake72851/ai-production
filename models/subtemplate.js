const mongoose = require("mongoose");
const moment = require("moment");
const mongoosePaginate = require("mongoose-paginate-v2");
const Design = require("./design");
const User = require("./user");
const Folder = require("./folder");

const subtemplateSchema = mongoose.Schema(
  {
    //유저 정보
    userId: {
      type: String,
      ref: "User",
    },
    //프로젝트 제목
    title: {
      type: String,
      default: "",
    },
    //템플릿 정보
    template: {
      type: String,
      ref: "Template",
    },
    //디자인 정보
    design: {
      type: String,
      ref: "Design",
    },
    //영수증 정보
    invoiceId: {
      type: mongoose.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    //유저 소스
    sources: {
      type: [[String]],
      select: false,
    },
    //현재 프로젝트 상태
    status: {
      type: Number,
      // enum: ['in_progress', 'rendering_ready', 'rendering', 'rendering_complete', 'rendering_confirm', 'preview'], // wait: -1
      default: 0,
    },
    //in_progress - 0 , rendering_ready - 1, rendering - 2, rendering_complete - 3 , rendering_confirm - 4, preview - 5
    //현재 프로젝트 작업도
    workProgress: {
      type: Number,
      default: 0,
    },
    renderProgress: {
      type: Number,
      default: 0,
    },
    //프로젝트 완료 영상
    resultVideo: {
      type: String,
      default: null,
    },
    //워터마크 영상
    watermarkVideo: {
      type: String,
      default: null,
    },
    thumnail: {
      type: String,
      default: null,
    },
    //커스터마이징 컬러
    changedColor: {
      type: [String],
      default: [null, null, null],
    },
    //현재 프레임
    currentFrame: {
      type: Number,
      default: null,
    },
    //프리뷰 상태
    previewStatus: {
      type: Number,
      // enum: ['preview_ready', 'preview_start', 'preview_ing'],
      default: 0,
    },
    //커스타미이징 음악
    bgmUrl: {
      type: String,
      default: null,
    },
    //음악 정보
    bgm: {
      type: String,
      ref: "Music",
      default: null,
    },
    fhd: {
      type: Boolean,
      default: false,
    },
    //언어 정보
    languageCode: {
      type: String,
      default: "ko",
    },
    //만료 날짜
    expired: {
      type: String,
      default: moment().add(30, "days").format("YYYY-MM-DD"),
    },
    // 렌더 완료 영상 확인 여부
    isChecked: {
      type: Boolean,
      default: false,
    },
    fromGPT: {
      type: Boolean,
    },
    fromAI: {
      type: Boolean,
    },
    folder: {
      type: mongoose.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    renderName: {
      type: String,
      default: "",
    },
    rendererId: Number,
    renderCompleteDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

subtemplateSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Subtemplate", subtemplateSchema);

module.exports.create = async (designId, userId, languageCode) => {
  return new Promise(async (resolve, reject) => {
    try {
      const design = await Design.findById(designId).select("+sources");
      if (!design) return reject("DESIGN_NOT_FOUND");

      let sources = [];
      for (let i = 0; i < design.sources.length; i++) {
        let source1 = [];
        for (let j = 0; j < design.sources[i].source.length; j++) {
          source1.push(design.sources[i].source[j].sourceContent);
        }
        sources.push(source1);
      }

      const user = await User.findById(userId)
        .select("payment.subscription")
        .lean();

      if (!user) return reject("USER_NOT_FOUND");

      let expired = null;
      if (user.payment.subscription != 1) {
        expired = moment().add(7, "days").format("YYYY-MM-DD");
      }

      const subtemplate = new module.exports({
        userId: userId,
        design: designId,
        invoiceId: invoiceId,
        languageCode: languageCode,
        expired: expired,
        sources,
      });
      subtemplate.save();

      if (!design.usedCnt) design.usedCnt = 0;
      design.usedCnt++;

      await design.save();
      console.log("usedCnt : " + design.usedCnt);
      return resolve(subtemplate);
    } catch (e) {
      console.error(e);
      return reject(e);
    }
  });
};
