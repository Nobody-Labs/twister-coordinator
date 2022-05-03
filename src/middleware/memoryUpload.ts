import multer = require('multer');

const memoryUpload: multer.Multer = multer({
    storage: multer.memoryStorage(), 
    fileFilter: (
        req: Express.Request, 
        file: Express.Multer.File, 
        callback: multer.FileFilterCallback 
    ) => {
        const regex: RegExp = /^withdraw_[0-9]{4}\.zkey$/g
        callback(null, regex.test(file.originalname));
    }
});

export default memoryUpload.fields([
    {
        name: 'contribution',
        maxCount: 1
    },
    {
        name: 'signer',
        maxCount: 1
    }
]);
