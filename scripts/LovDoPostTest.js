
const USER_VALUE_PROVIDER_ADDRESS = "0x0000000000000000000000000000000000000000";
const USER_RECOMMENDER_ADDRESS = "0x0000000000000000000000000000000000000000";
const USER_LIKE_ISSUER_1_ADDRESS = "0x0000000000000000000000000000000000000000";
const USER_LIKE_ISSUER_2_ADDRESS = "0x0000000000000000000000000000000000000000";
const USER_LIKE_ISSUER_3_ADDRESS = "0x0000000000000000000000000000000000000000";


// Main user scenario script
async function main() {

    // Exstracting user wallet by USER_RECOMMENDER_ADDRESS
    const userWallet = await hre.ethers.getSigner(USER_RECOMMENDER_ADDRESS);
    
    // Exstracting value provider wallet by USER_VALUE_PROVIDER_ADDRESS
    const valueProviderWallet = await hre.ethers.getSigner(USER_VALUE_PROVIDER_ADDRESS);

    // Generating LoveDoPostNFT contents with text and image uploaded to Pinata
    const postNFTData = await generatePostNFTData(userWallet, valueProviderWallet);

    // Mint LoveDoPostNFT to user wallet
    const mintLoveDoPostNFT = await loveDoPostNFT.connect(userWallet).createPost(
        postNFTData.valueProviderWallet, 
        postNFTData.contentURI
    );


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });