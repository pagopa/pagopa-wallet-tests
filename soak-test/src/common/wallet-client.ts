import http from "k6/http"
import { Wallets } from "../generated/wallet/Wallets";


export const getWalletsByUserId = (urlBasePath: string, token: string, blueDeployment: boolean) => {
    const response = http.get(`${urlBasePath}/wallets`, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(blueDeployment ? {"deployment": "blue" } : {}),
        }
    });
    console.log(response.json());
    return response.json() as Wallets
}