const mongoose = require('mongoose');

const audioSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    audioUrl: { type: String, required: true },
    audioPublicID: { type: String, required: true },
    coverUrl: { type: String, required: true },
    coverPublicID: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
        type: String, required: true, enum: [
            "Pop",
            "Hip Hop",
            "Rap",
            "Rock",
            "R&B",
            "Jazz",
            "Classical",
            "Electronic",
            "Lo-Fi",
            "Indie",
            "Metal",
            "Folk",
            "Instrumental",
            "Soundtrack",
            "Other"
        ]
    },
    type: { type: String, required: true, enum: {
        values: ["Private", "Public"],
        message: '{VALUE} is not supported. Please choose either Private or Public'
    } },
}, { timestamps: true });

const Audio = mongoose.model('Audio', audioSchema);

module.exports = Audio;