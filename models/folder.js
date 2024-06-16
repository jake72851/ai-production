const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')
const aggregatePaginate = require('mongoose-aggregate-paginate-v2')

const folderSchema = mongoose.Schema({
	// 유저 아이디
	userId: {
		type: String,
		required: true
	},
    // 폴더명 (상품이름 - product.name)
    name: {
        type: String,
        required: true
    },
    folderType: {
        type: Number,
        default: 101  
        // 101: 유저가 직접 생성한 프로젝트용 폴더
        // 201: 상품 영상 제작으로 생성된 프로젝트용 폴더
        // 301: 보관함 폴더 
        // ... 추후 필요시 추가
    },
    // 경로
    parentId: {
        type: mongoose.Types.ObjectId,
        default: null
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

folderSchema.plugin(mongoosePaginate)
folderSchema.plugin(aggregatePaginate)

module.exports = mongoose.model('Folder', folderSchema)