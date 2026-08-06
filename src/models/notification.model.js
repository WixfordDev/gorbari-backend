const mongoose = require('mongoose');
const { Schema } = mongoose;
const { roles } = require("../config/roles");
const { toJSON, paginate } = require("./plugins");

const notificationSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sendBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    transactionId: {
        type: String,
        required: false,
        default: null
    },
    // No default: `default: null` combined with `enum` set every notification's
    // role to the literal value null and then validated it against the enum,
    // which never includes null - so every single Notification.create() call
    // failed validation. Leaving it unset when not provided skips validation
    // for that path entirely, the same trap documented for Property.slug.
    role: {
        type: String,
        required: false,
        enum: roles,
    },
    title: {
        type: String,
    },
    content: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        required: false
    },
    devStatus: {
        type: String,
        required: false
    },
    image: {
        type: String,
        required: false
    },
    status: {
        type: String,
        enum: ['unread', 'read'],
        default: 'unread'
    },
    type: {
        type: String,
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
},
    {
        timestamps: true
    });

notificationSchema.plugin(toJSON);
notificationSchema.plugin(paginate);

module.exports = mongoose.model("Notification", notificationSchema);
