import DiscordStrategy from "passport-discord";
import refresh from "passport-oauth2-refresh";
import DiscordOAuth2 from "discord-oauth2";
import client from "../..";
import { Server } from "../../lib/model/Server";
import { AuthedUserServer } from "../interfaces";
import UserService from "./UserService";

const userService = new UserService();
const discordOAuthService = new DiscordOAuth2();
export default class DiscordService {
    private async fetchUserGuilds(accessToken: string) {
        return await discordOAuthService.getUserGuilds(accessToken);
    }

    private async getAllGuilds(id: string, accessToken: string, refreshToken: string) {
        let guilds: any[];

        try {
            guilds = await this.fetchUserGuilds(accessToken);
        } catch (err) {
            console.error(`Error while fetching user guilds: ${err}`);
            refresh.requestNewAccessToken(
                "discord",
                refreshToken,
                async (err, accessToken, refreshToken) => {
                    // o_O wonKy
                    if (err) {
                        console.error(err.statusCode);
                        client.emit("error", err.data);
                        throw err;
                    }
                    await userService.saveTokensToUser(id, accessToken, refreshToken);
                    guilds = await this.fetchUserGuilds(accessToken);
                }
            );
        }

        const allGuilds: AuthedUserServer[] = await Promise.all(
            guilds.map(async (guild: DiscordStrategy.GuildInfo) => {
                const isPayloadIn = client.guilds.cache.find(
                    clientGuild => clientGuild.id === guild.id
                )
                    ? true
                    : false;

                let server = null;

                if (isPayloadIn) {
                    server = await Server.findOne({ id: guild.id });

                    if (server === null) server = await Server.create({ id: guild.id });

                    return {
                        iconUrl:
                            guild.icon &&
                            `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`,
                        isPayloadIn: isPayloadIn,
                        server,
                        ...guild,
                    };
                }
                return {
                    iconUrl:
                        guild.icon &&
                        `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`,
                    isPayloadIn: isPayloadIn,
                    ...guild,
                };
            })
        );

        return allGuilds;
    }

    async getAuthedGuilds(id: string, accessToken: string, refreshToken: string) {
        const allGuilds = await this.getAllGuilds(id, accessToken, refreshToken);

        /*
			This returns all guilds that are:
			1) Within bot cache && Administrator permissions
			2) User has permissions 0x8, which is Administrator

			.cache may be subject to fail here.
		*/
        const filteredGuilds = allGuilds.filter(
            guild =>
                (client.guilds.cache.find(clientGuild => guild.id === clientGuild.id) &&
                    (guild.permissions & 0x8) === 0x8) ||
                (guild.permissions & 0x8) === 0x8
        );

        return filteredGuilds.sort((a, b) => (b.isPayloadIn ? 1 : -1) - (a.isPayloadIn ? 1 : -1));
    }
}
