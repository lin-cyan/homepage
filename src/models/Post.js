import mongoose from "mongoose";

const { Schema } = mongoose;

const postSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    desc: {
      type: String,
      required: true,
    },
    img: {
      type: String,
      required: true,
    },
    tag:{
      type: String,
      require: false,
    },
    
    // 画布文章的 content 为空，必填校验放在 API 层（update validator 里拿不到 isCanvas）
    content: {
      type: String,
      default: "",
    },
    isCanvas: {
      type: Boolean,
      default: false,
    },
    canvasData: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    username: {
      type: String,
      required: true,
    },
    externalArticle:{
      type: Boolean,
      default: false
    },
    showInBlog: {
      type: Boolean,
      default: true
    },
    isQuote: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

//If the Post collection does not exist create a new one.
export default mongoose.models.Post || mongoose.model("Post", postSchema);
