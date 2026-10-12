import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { ThreadType } from "../models/index.js";
import { apiFactory } from "../utils.js";

/**
 * Params of a pinned-message topic (topic type 2), same keys Zalo Web builds in `createPinTopicFromMessage`.
 * `msg_type` is the client message type (1 text, 32 photo, 31 voice, 44 video, 46 file, 36 sticker...).
 */
export type PinMessageParams = {
    client_msg_id: string;
    global_msg_id: string;
    senderUid: string;
    senderName: string;
    msg_type: number;
    title?: string;
    thumb?: string;
};

export type PinMessageResponse = unknown;

const MESSAGE_TOPIC = 2;
const DEFAULT_COLOR = -16777216;

export const pinMessageFactory = apiFactory<PinMessageResponse>()((api, ctx, utils) => {
    const friendBoardList = utils.makeURL(`${api.zpwServiceMap.friend_board[0]}/api/friendboard/list`);
    const friendBoardCreate = utils.makeURL(`${api.zpwServiceMap.friend_board[0]}/api/friendboard/create`);
    const groupTopicCreate = utils.makeURL(`${api.zpwServiceMap.group_board[0]}/api/board/topic/createv2`);

    const encode = (data: unknown) => {
        const encrypted = utils.encodeAES(JSON.stringify(data));
        if (!encrypted) throw new ZaloApiError("Failed to encrypt params");
        return encrypted;
    };

    /**
     * Pin a message to the top of a conversation (Zalo Web: friendboard/create for 1-1, board/topic/createv2 for groups).
     * 1-1 conversations allow at most 3 pinned topics; the server rejects more.
     *
     * @param params pinned message params (ids of the message + sender + preview)
     * @param threadId user id (1-1) or group id
     * @param type thread type
     *
     * @throws {ZaloApiError}
     */
    return async function pinMessage(params: PinMessageParams, threadId: string, type: ThreadType = ThreadType.User) {
        if (type === ThreadType.Group) {
            const body = {
                grid: threadId,
                type: MESSAGE_TOPIC,
                color: DEFAULT_COLOR,
                emoji: "",
                startTime: -1,
                duration: -1,
                params: JSON.stringify(params),
                repeat: 0,
                src: 1,
                imei: ctx.imei,
                pinAct: 1,
            };
            const response = await utils.request(groupTopicCreate, {
                method: "POST",
                body: new URLSearchParams({ params: encode(body) }),
            });
            return utils.resolve(response);
        }

        // The board version must match the server's current one, read it first (like Zalo Web does).
        const listRes = await utils.request(
            utils.makeURL(friendBoardList, { params: encode({ conversationId: threadId, version: 0, imei: ctx.imei }) }),
            { method: "GET" },
        );
        const board = (await utils.resolve(listRes)) as { version?: number } | null;
        const topic = {
            color: DEFAULT_COLOR,
            duration: -1,
            emoji: "",
            params: JSON.stringify(params),
            repeat: 0,
            startTime: -1,
            type: MESSAGE_TOPIC,
            src: -1,
            pinAct: 1,
        };
        const payload = { conversationId: threadId, topic, version: board?.version ?? 0, lang: "vi", imei: ctx.imei };
        const response = await utils.request(utils.makeURL(friendBoardCreate, { params: encode(payload) }), { method: "GET" });
        return utils.resolve(response);
    };
});
