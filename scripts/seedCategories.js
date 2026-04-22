const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Category = require('../Model/categoryModel');

const CLOUD_NAME = "dxm28ujz3";
const UPLOAD_PRESET = "unsigned_products";

const categoriesData = [
    {
        name: {
            en: "Koli Avarai",
            ta: "கோழி அவரை",
            hi: "कोली अवारा",
            te: "కోలి అవారా",
            kn: "ಕೋಲಿ ಅವಾರಾ",
            ml: "കോളി അവാര"
        },
        localImage: "koli_avarai_seeds.png"
    },
    {
        name: {
            en: "Drum Seeds",
            ta: "முருங்கை விதைகள்",
            hi: "सहजन के बीज",
            te: "మునగ గింజలు",
            kn: "ನುಗ್ಗೆ ಬೀಜಗಳು",
            ml: "മുരിങ്ങ വിത്തുകൾ"
        },
        localImage: "drum-seeds.png"
    },
    {
        name: {
            en: "Napier Grass",
            ta: "நேபியர் புல்",
            hi: "नेपियर घास",
            te: "నేపియర్ గడ్డి",
            kn: "ನೇಪಿಯರ್ ಹುಲ್ಲು",
            ml: "നേപ്പിയർ പുല്ല്"
        },
        localImage: "napier-grass.png"
    },
    {
        name: {
            en: "Organic Seeds",
            ta: "இயற்கை விதைகள்",
            hi: "जैविक बीज",
            te: "సేంద్రియ విత్తనాలు",
            kn: "ಸಾವಯವ ಬೀಜಗಳು",
            ml: "ജൈവ വിത്തുകൾ"
        },
        localImage: "seeds-package-removebg-preview.png"
    },
    {
        name: {
            en: "Vegitables Seeds",
            ta: "காய்கறி விதைகள்",
            hi: "सब्जियों के बीज",
            te: "కూరగాయల విత్తనాలు",
            kn: "ತರಕಾರಿ ಬೀಜಗಳು",
            ml: "പച്ചക്കറി വിത്തുകൾ"
        },
        localImage: "special-seeds.png"
    }
];

async function uploadImage(fileName) {
    const filePath = path.join(__dirname, '../../frontend/public', fileName);
    if (!fs.existsSync(filePath)) return null;

    try {
        const fileData = fs.readFileSync(filePath);
        const base64Image = `data:image/png;base64,${fileData.toString('base64')}`;
        const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            file: base64Image,
            upload_preset: UPLOAD_PRESET,
            folder: "categories"
        });
        return res.data.secure_url;
    } catch (err) {
        return null;
    }
}

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Purging old categories...");
        
        // Remove categories where name is just a string (old format) 
        // or just clear all and re-add to be safe since it's a specific request.
        await Category.deleteMany({ _id: { $ne: "69ce1aee2b22a0f1e8fe00b9" } }); // Keep Cucumber, remove others

        for (const data of categoriesData) {
            const url = await uploadImage(data.localImage);
            if (url) {
                await Category.create({ name: data.name, image: [url] });
                console.log(`Created: ${data.name.en}`);
            }
        }

        console.log("Migration complete!");
        process.exit();
    } catch (err) {
        process.exit(1);
    }
}

seed();
