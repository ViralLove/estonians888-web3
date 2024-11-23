const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Минтинг от имени аккаунта:", deployer.address);

    const contractAddress = process.env.AMOY_INVITE_CONTRACT;
    const Estonians888InviteNFT = await hre.ethers.getContractFactory("Estonians888InviteNFT");
    const contract = await Estonians888InviteNFT.attach(contractAddress);

    // Адрес, на который будут минтиться токены
    const recipient = deployer.address;

    // Массив инвайтов с метаданными, размещенными на Pinata
    const inviteData = [
    { code: "VL888-114-873", uri: "https://gateway.pinata.cloud/ipfs/QmaEe69PbUgVrDb36AjjJejFhAaXcygjAxK6d1ZRvta7Zj" },
    { code: "VL888-118-218", uri: "https://gateway.pinata.cloud/ipfs/Qmdo5FQJk2sbUtLuire1Xx8x8R4VCnF64Begt9Z55rq9kV" },
    { code: "VL888-118-492", uri: "https://gateway.pinata.cloud/ipfs/QmewpQqyFUMsK4vqnaDKQXjg5jMXpfnNDfmVJcj7X3Q6Yo" },
    { code: "VL888-119-587", uri: "https://gateway.pinata.cloud/ipfs/QmdhefZLpPkWmVZ2Gph49oNr7fwcpZxdDuE9doJbaWRyqi" },
    { code: "VL888-119-817", uri: "https://gateway.pinata.cloud/ipfs/QmNojmKrG1u4McMsSwXNASDjg5EF4JhE75sAnmwoCVjuSz" },
    { code: "VL888-123-481", uri: "https://gateway.pinata.cloud/ipfs/QmVoXAand4ETpX3LAtZR3AFZmk4Fundq9WTCVThdZBcFyJ" },
    { code: "VL888-128-315", uri: "https://gateway.pinata.cloud/ipfs/QmdRVbhvFYfoihe4FjwmAxbmRJU5uU9ERfKVPaPCCg1fHH" },
    { code: "VL888-131-835", uri: "https://gateway.pinata.cloud/ipfs/Qmbn29Mi6dGvCjT8j2hspMU4EgU9gkqMoMU91QUEBbLhpk" },
    { code: "VL888-133-669", uri: "https://gateway.pinata.cloud/ipfs/QmZUz6XLxHVVrgwvBHVEcdF4Qpg6ZMtXotifp6am7tUuSo" },
    { code: "VL888-145-716", uri: "https://gateway.pinata.cloud/ipfs/QmWnAnTZYrJmZFqisVYksdzCQDhFcxcesHzmDE1GtmUaVi" },
    { code: "VL888-156-257", uri: "https://gateway.pinata.cloud/ipfs/QmYSeisu1jJ5bKpcGa4CxAuwhUjxf7s5GyfN21effmbJRo" },
    { code: "VL888-159-961", uri: "https://gateway.pinata.cloud/ipfs/QmWxcg9YjcgY1msHYcD4TRZ7P5pDChbF9trt1sMqX1fgne" },
    { code: "VL888-168-461", uri: "https://gateway.pinata.cloud/ipfs/QmUR9t6qayur3JfQXSFwXmwC7wL1oDyuBKsFP932xQY8Vk" },
    { code: "VL888-177-196", uri: "https://gateway.pinata.cloud/ipfs/QmQWZxBVFum9Db7j2jxnnKdYBkVgmnGpz3DAvjuCTTK6SB" },
    { code: "VL888-192-839", uri: "https://gateway.pinata.cloud/ipfs/QmXR1e8bZHZSQ93Cy8VeCKaBx12ARzYuWnv4vhWfPcBCWZ" },
    { code: "VL888-217-347", uri: "https://gateway.pinata.cloud/ipfs/QmdcSwcXU8EcLHziCaYVcm7TW9Xc64fePMUBrUcbVdSgH7" },
    { code: "VL888-239-632", uri: "https://gateway.pinata.cloud/ipfs/QmZRgrdcY1CUvsczv5KvbbVuUUpXN6NEDMYhxHrSkco5JP" },
    { code: "VL888-255-438", uri: "https://gateway.pinata.cloud/ipfs/QmcuKcs59J3YSwGWZDX7iPhUofyjAxz4hjebg6mDg8RVPQ" },
    { code: "VL888-259-613", uri: "https://gateway.pinata.cloud/ipfs/QmfGPYRBB8eJXFA9RDuJj3hF2vjSzQ3hJM1ZCPUDaFdxxN" },
    { code: "VL888-259-962", uri: "https://gateway.pinata.cloud/ipfs/QmU3UaodPX1gn2EKcVuZ35bNSCHKXTsM5F1T8nqr1bwe3g" },
    { code: "VL888-263-524", uri: "https://gateway.pinata.cloud/ipfs/QmRKd9mSffYp5nccUNLnUKtPyEcp8LRM8URkteXA5FKPpS" },
    { code: "VL888-289-526", uri: "https://gateway.pinata.cloud/ipfs/QmPnCCRykX32irZyT2WiearK5qTWHatf1aWdGsvV27kAWa" },
    { code: "VL888-292-785", uri: "https://gateway.pinata.cloud/ipfs/QmXHHPmdiWeS92z2B4RLN2LkEpAd1WPZdavHFT2QM1Buwa" },
    { code: "VL888-299-314", uri: "https://gateway.pinata.cloud/ipfs/QmXRu4P5RhkHZS3H22kQgTmnrFekGkRK978daDQyqWHmmf" },
    { code: "VL888-313-587", uri: "https://gateway.pinata.cloud/ipfs/Qmc2Bzgqj79PKBzVppQYDdwsPf6YJU9EXq8utuCPr4cXwS" },
    { code: "VL888-316-492", uri: "https://gateway.pinata.cloud/ipfs/QmTArsUtQ4FKSozEX4dSX6SumFVPibWeaukf2SWQkMfTJX" },
    { code: "VL888-336-938", uri: "https://gateway.pinata.cloud/ipfs/QmUcnKQQSbAYbPXraeYQqHFuNT9gzD8yUzWiZswJz5D15j" },
    { code: "VL888-353-353", uri: "https://gateway.pinata.cloud/ipfs/QmZiRPrVPgjwq4KfbgYj5j8CuGLBrS1sQwUFDR1D5FmUKV" },
    { code: "VL888-368-792", uri: "https://gateway.pinata.cloud/ipfs/QmNXcBwS9p11rsnSWx61pWYrcE8NRykoAwZa9VumX5K3JG" },
    { code: "VL888-373-452", uri: "https://gateway.pinata.cloud/ipfs/QmaBxCiZWBusYD2Angvz2ZWNcof3eTQ3iguuaLsJ5QY1tQ" },
    { code: "VL888-383-839", uri: "https://gateway.pinata.cloud/ipfs/QmYEy8ByjWuyDL5GVhBLzUNdVJHhwfo76nfHCgdTzX8aaq" },
    { code: "VL888-417-117", uri: "https://gateway.pinata.cloud/ipfs/QmRJ5TMFZNaed6EHCEE7NZxRXdervYS3fgbek5gktyWv1F" },
    { code: "VL888-425-456", uri: "https://gateway.pinata.cloud/ipfs/QmQXBEsDHE64A9QN1z3ZvSZoTTebcWP89iywP2uPa1tqq8" },
    { code: "VL888-427-817", uri: "https://gateway.pinata.cloud/ipfs/QmXbQqQpZD6cs6a9K4UqNkkd1WBcH45DjgDo7Ebz7eYLt4" },
    { code: "VL888-443-325", uri: "https://gateway.pinata.cloud/ipfs/QmWwxLJC9gKaLV6sbYCpGat5h5hk9n3M3YtLGqY2NjyiQa" },
    { code: "VL888-454-338", uri: "https://gateway.pinata.cloud/ipfs/QmTdM1DxJH33EgA3cvzePb7TSjzimEmjNX1TkqZa2Y34P7" },
    { code: "VL888-473-165", uri: "https://gateway.pinata.cloud/ipfs/QmPCVffAzdFSzw5HD5Bi9ThXQPuHCXoSmMPdp1sBjevQ2b" },
    { code: "VL888-478-399", uri: "https://gateway.pinata.cloud/ipfs/QmV3dUSbj9rXQFzbErA2rhRR79YucKfD9sMNaKD4ffcdSf" },
    { code: "VL888-491-463", uri: "https://gateway.pinata.cloud/ipfs/QmTMdcB3yCj1W5r8JvDaE4Vkt4z9T9eAuD9eebP2DqSH77" },
    { code: "VL888-499-222", uri: "https://gateway.pinata.cloud/ipfs/QmaPxpn3bqRbMJVn2dyACqDUFV4MMNj5A87s3A4fBo5u2F" },
    { code: "VL888-499-825", uri: "https://gateway.pinata.cloud/ipfs/QmeuEmdxcv7LKaAWcsoysG73YiADV57jM9HtGHqVic6euw" },
    { code: "VL888-523-693", uri: "https://gateway.pinata.cloud/ipfs/Qmf8eJiGJEYQZKuX8acBU4JWeBR1W77X5KbMksXqHTDrXv" },
    { code: "VL888-523-997", uri: "https://gateway.pinata.cloud/ipfs/QmYTWRz9F6uxxqwUEuGzudVsUud1XMtnE7jTn2w4NhM8rt" },
    { code: "VL888-533-448", uri: "https://gateway.pinata.cloud/ipfs/QmZQSYvHwvgQrt3DcFu89LJfBXTwzV6gFFKt2yfS9iJoK7" },
    { code: "VL888-542-831", uri: "https://gateway.pinata.cloud/ipfs/QmNu4Ghm6nPrpEfNCzEbZtDHbMPhh57GwJcsNk2PgpdkJK" },
    { code: "VL888-586-938", uri: "https://gateway.pinata.cloud/ipfs/QmecDSPbbok7LSdgvFE6dy7zsvKhGEfppVCrjH1f7FQVKT" },
    { code: "VL888-599-966", uri: "https://gateway.pinata.cloud/ipfs/QmNpSsYLEVKibtLtBGP25RLhjCKsV21pJ67cgY7ZfXjS8W" },
    { code: "VL888-616-471", uri: "https://gateway.pinata.cloud/ipfs/QmdfmspnzQKHTehdANSs5R2aw56MP7CtmgH3FH3P7JYy2D" },
    { code: "VL888-617-867", uri: "https://gateway.pinata.cloud/ipfs/Qmf7xDRPmnnaGtRbwQm22XVzUdLHu6rspWXKtL3HoFfN7d" },
    { code: "VL888-634-797", uri: "https://gateway.pinata.cloud/ipfs/QmY5GT2K9tCw5LEmPBo7Ybd9uVrnC33oBFGVg5zRZsA7yB" },
    { code: "VL888-648-698", uri: "https://gateway.pinata.cloud/ipfs/QmXK45FAafSEbaaQbDWck7RG8rxTXUGx2ovayiPwd5JRvC" },
    { code: "VL888-652-732", uri: "https://gateway.pinata.cloud/ipfs/QmXFd6i8LiKn1S7BcevNVP5nnewve7VgDrifQdxRc48njy" },
    { code: "VL888-655-975", uri: "https://gateway.pinata.cloud/ipfs/Qmdd6Q8Ez9QqMmhK8Car9F1iEivGEyYTUZGnVEJbxFDJVv" },
    { code: "VL888-656-448", uri: "https://gateway.pinata.cloud/ipfs/QmTCo35CKF9zCNKtAzKpsHBwyu5CFtW1WhgBAswTx1Hsbm" },
    { code: "VL888-667-562", uri: "https://gateway.pinata.cloud/ipfs/QmQTUNPBBafbbtFoWZM9aVfHBrQ8vb1ZNHKH9TuyVtffQA" },
    { code: "VL888-683-446", uri: "https://gateway.pinata.cloud/ipfs/QmavmD6gDmmCRJbVMTMrT6FWrBmiZPvB7qpEBsBZRrhN1Y" },
    { code: "VL888-687-459", uri: "https://gateway.pinata.cloud/ipfs/QmfR6SePuzdaQoNPwtnSDUciyH7UbVvMuBpcwvTfKqGXcg" },
    { code: "VL888-699-919", uri: "https://gateway.pinata.cloud/ipfs/QmbwVrbBs83HuCG63AzQnGqh4fjzMDE8UWCp3wsibguL5f" },
    { code: "VL888-716-831", uri: "https://gateway.pinata.cloud/ipfs/QmfEpGzj74JfSes1F5sBhwuxzTUoGcmMPDbXF4WYFq9uDH" },
    { code: "VL888-725-431", uri: "https://gateway.pinata.cloud/ipfs/QmbX38pg4zV7ppfWWG2xkYkQjHpW8cQUbo8cs1Djf4pTjT" },
    { code: "VL888-733-494", uri: "https://gateway.pinata.cloud/ipfs/QmSNJXDg7uo7dibdba1ugUcTVeRZYGErZbYPXtPBypAGo1" },
    { code: "VL888-742-818", uri: "https://gateway.pinata.cloud/ipfs/QmeQSc2kag2QAfdzVxj7AgDZjZp1tKvtGuFqfWsvwzC8rF" },
    { code: "VL888-754-268", uri: "https://gateway.pinata.cloud/ipfs/QmYb7Y3efaPnWwPBCUYKyWRLHPvcjmVd6kQG5q2bRa3u9J" },
    { code: "VL888-771-845", uri: "https://gateway.pinata.cloud/ipfs/QmXGasuGxFMLKrRc2YgUSkWdr7Z38b4teMZ5pJFPZr4V1D" },
    { code: "VL888-781-422", uri: "https://gateway.pinata.cloud/ipfs/QmXG1LpEbXT5KrhDPi9jaUBRwJLiCJPwcTteA6hHGbB4HZ" },
    { code: "VL888-789-621", uri: "https://gateway.pinata.cloud/ipfs/QmR1aj4iCeR2hJGNWtepssQTWiEgZSoTNBC5VFzgNRkjgh" },
    { code: "VL888-789-853", uri: "https://gateway.pinata.cloud/ipfs/QmQAXxknuazfqgUBSVFRzomgAEF4Nns3xeL6J5myPuhjtX" },
    { code: "VL888-795-477", uri: "https://gateway.pinata.cloud/ipfs/QmVTv29X1ZXzXmG13UNr2aH32TMiEXrwitzKjNeuyk1Znx" },
    { code: "VL888-822-723", uri: "https://gateway.pinata.cloud/ipfs/QmU3f6tqqbspaFPZWPBXA8n7WV6Aii1TYPKhD8qFzThBV6" },
    { code: "VL888-826-265", uri: "https://gateway.pinata.cloud/ipfs/QmPGVgu9z3s2iddaiNJUhmEsbgFT9GaDDHVT9kqizZPEtF" },
    { code: "VL888-827-295", uri: "https://gateway.pinata.cloud/ipfs/QmaUzuUXFFmHmwmt3umRqUaMQ7SZMoqNxfwwMqUN11J7mf" },
    { code: "VL888-833-427", uri: "https://gateway.pinata.cloud/ipfs/QmQaHjT7y2uxL4NuEjV1oec5NzMJczans9vnkBDMkK9mcM" },
    { code: "VL888-835-131", uri: "https://gateway.pinata.cloud/ipfs/QmRBXU5X6PXYJG73s2tuR1ebDb1xR8pYVwkWTJAxaHqhga" },
    { code: "VL888-853-653", uri: "https://gateway.pinata.cloud/ipfs/QmNSS1MWLFFqgUS4iT8FkCNsqx8QZu1RThYTuvnPhX99cn" },
    { code: "VL888-861-284", uri: "https://gateway.pinata.cloud/ipfs/QmXfKCcSQzN64798wEoqbjtiJQxhNThVzCvATWYsshVJCS" },
    { code: "VL888-862-463", uri: "https://gateway.pinata.cloud/ipfs/QmXmxLSiEAuZkxZSfoc2oMEqMZGckmvN5knRufSEtFJ2kp" },
    { code: "VL888-885-555", uri: "https://gateway.pinata.cloud/ipfs/QmVLiGrCCVwzYm8D2yfb1YdHLhCNQqjwuNTY9idr948iBe" },
    { code: "VL888-911-778", uri: "https://gateway.pinata.cloud/ipfs/QmeJzg5FMbXrcamio35hhiFaEpByFV4t2YdeFdeFMzDKhT" },
    { code: "VL888-921-173", uri: "https://gateway.pinata.cloud/ipfs/QmYZqySvgsdGzo5FkJQ8XSDc7YuKq8yoiA3k4jsaYetfKg" },
    { code: "VL888-924-911", uri: "https://gateway.pinata.cloud/ipfs/QmdSDvLt984vYpfmnJLbTviHhyBJuDnqsjvA1L3pxVNxGw" },
    { code: "VL888-927-369", uri: "https://gateway.pinata.cloud/ipfs/QmZnWXLc517vBy6kRQ6vHdPzP3Gw1sL5Y96FrCKXor4bJq" },
    { code: "VL888-928-929", uri: "https://gateway.pinata.cloud/ipfs/QmTvQ7kNnowcSNw3r4rAzfRkKAb6jQGqpjNx2psGfBSxBf" },
    { code: "VL888-937-552", uri: "https://gateway.pinata.cloud/ipfs/QmTWheVcFGxuxg5Lvrbj9do6FZFuoJ21uZAAdaGogUT2gB" },
    { code: "VL888-945-284", uri: "https://gateway.pinata.cloud/ipfs/QmYmk9PDcgnHyCN4RBYAM8Q7pxnsduAdwe1FHsTrnjvkoL" },
    { code: "VL888-949-754", uri: "https://gateway.pinata.cloud/ipfs/Qmbx8JxqaRgVEPE7uemzqCi8yjioKp9oQQKQs7tZa4gQA4" },
    { code: "VL888-955-657", uri: "https://gateway.pinata.cloud/ipfs/QmNgmnzg2wz4PSUEw6FwniijekSKsNJBA4FAZYVNiavDXv" },
    { code: "VL888-985-827", uri: "https://gateway.pinata.cloud/ipfs/QmTmBtnq7Hq6SX16j2A9YtLP8xpighLg6xnpUm38FAi46Q" },
    { code: "VL888-991-525", uri: "https://gateway.pinata.cloud/ipfs/QmaebjsE9P8JqpuTrornVkz1Q1iRsg55TiPEMpLcHeMLrR" },

    ];

    // Выведем заголовок CSV
    console.log('invite-code,CID,tokenId');
    
    for (const { code, uri } of inviteData) {
        // Извлекаем CID из URI
        const cid = uri.split('/').pop();
        
        // Минтим NFT
        const tx = await contract.mintInvite(recipient, code, uri);
        const receipt = await tx.wait();
        
        // Получаем tokenId из события Transfer
        const transferEvent = receipt.logs.find(
            log => log.fragment && log.fragment.name === 'Transfer'
        );
        const tokenId = transferEvent ? transferEvent.args[2] : 'unknown';
        
        // Выводим данные в CSV формате
        console.log(`${code},${cid},${tokenId}`);
    }

    console.log("Минтинг завершен для всех инвайтов.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
