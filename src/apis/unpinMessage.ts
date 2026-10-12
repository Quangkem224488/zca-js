import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { ThreadType } from "../models/index.js";
import { apiFactory } from "../utils.js";

export type UnpinMessageResponse = unknown;

const MESSAGE_TOPIC = 2;

export const unpinMessageFactory = apiFactory<UnpinMessageResponse>()((api, ctx, utils) => {
    const friendBoardList = utils.makeURL(`${api.zpwServiceMap.friend_board[0]}/api/friendboard/list`);
    const friendBoardUnpin = utils.makeURL(`${api.zpwServiceMap.friend_board[0]}/api/friendboard/multi_unpin`);
    const groupPinList = utils.makeURL(`${api.zpwServiceMap.group_board[0]}/api/board/pin/list`);
    const groupUnpin = utils.makeURL(`${api.zpwServiceMap.group_board[0]}/api/board/unpinv2`);

    const encode = (data: unknown) => {
        const encrypted = utils.encodeAES(JSON.stringify(data));
        if (!encrypted) throw new ZaloApiError("Failed to encrypt params");
        return encrypted;
    };

    /**
     * Unpin a pinned message topic (Zalo Web: friendboard/multi_unpin for 1-1, board/unpinv2 for groups).
     *
     * @param topicId id of the pinned topic (from getFriendBoardList / getListBoard)
     * @param threadId user id (1-1) or group id
     * @param type thread type
     *
     * @throws {ZaloApiError}
     */
    return async function unpinMessage(topicId: string, threadId: string, type: ThreadType = ThreadType.User) {
        const topicRef = { topicId, topicType: MESSAGE_TOPIC };
        if (type === ThreadType.Group) {
            const listRes = await utils.request(
                utils.makeURL(groupPinList, { params: encode({ groupId: threadId, boardVersion: 0, imei: ctx.imei }) }),
                { method: "GET" },
            );
            const board = (await utils.resolve(listRes)) as { boardVersion?: number; version?: number } | null;
            const payload = { grid: threadId, imei: ctx.imei, topic: topicRef, boardVersion: board?.boardVersion ?? board?.version ?? 0 };
            const response = await utils.request(utils.makeURL(groupUnpin, { params: encode(payload) }), { method: "GET" });
            return utils.resolve(response);
        }

        const listRes = await utils.request(
            utils.makeURL(friendBoardList, { params: encode({ conversationId: threadId, version: 0, imei: ctx.imei }) }),
            { method: "GET" },
        );
        const board = (await utils.resolve(listRes)) as { version?: number } | null;
        const payload = { conversationId: threadId, topics: [topicRef], version: board?.version ?? 0, lang: "vi", imei: ctx.imei };
        const response = await utils.request(utils.makeURL(friendBoardUnpin, { params: encode(payload) }), { method: "GET" });
        return utils.resolve(response);
    };
});
