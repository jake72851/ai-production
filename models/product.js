const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')
const Folder = require('./folder')

const productSchema = mongoose.Schema({
	// 유저 아이디
	userId: {
		type: String,
		required: true
	},
    // 제품명
    name: {
        type: String,
        required: true
    },
    // 제품 정보
    detail: {
        type: String,
        required: true
    },
    // 정가
    price: {
        type: Number,
        required: true
    },
    // 할인 판매가격
    discountPrice: {
        type: Number,
        default: null
    },
    // 화폐
    currency: {
        type: String,
        required: true
        // [KRW, USD, IDR]
    },
    // 상품 관련 이미지 (첫번째 이미지가 상품 썸네일)
    images: {
        type: Array,
        default: [] // { assetId: Asset._id, url: String }
    },
    // 상품 관련 영상 (이미지가 없을때, 첫번째 영상의 썸네일이 상품 썸네일)
    videos: {
        type: Array,
        default: [] // { assetId: Asset._id, url: String }
    },
    // 상품 즐겨찾기 (유저의 상품이라 별도의 컬렉션 생성대신 상품 컬렉션에 값 저장)
    like: {
        type: Boolean,
        default: false
    },
    folder: {
        type: mongoose.Types.ObjectId,
        ref: 'Folder'
    },
    designRecommendation: {
        tempo: {
            type: String
        },
        style: {
            type: String
        },
        reason: {
            type: String
        }
    },
    isModifiedContent: {
        type: Boolean,
        default: false
    },
    // 업로드페이지 삭제 기능 false 일때 리스트에서 삭제
    isUpload: {
        type: Boolean,
        default: true
    },
    siteLang: {
        type: String
    }
}, {
	versionKey: false,
	timestamps: true,
	toJSON: { 
	    virtuals: true,
	    transform: function (doc, ret) {
                delete ret.id;
                delete ret.__v;
                return ret;
            }
	},
})

productSchema.plugin(mongoosePaginate)

module.exports = mongoose.model('Product', productSchema)