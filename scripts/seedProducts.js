const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Category = require('../Model/categoryModel');
const Product = require('../Model/ProductModel');

const CLOUD_NAME = "dxm28ujz3";
const UPLOAD_PRESET = "unsigned_products";

async function uploadImage(fileName) {
    const filePath = path.join(__dirname, '../../frontend/public', fileName);
    if (!fs.existsSync(filePath)) {
        console.warn(`Local file not found: ${filePath}`);
        return null;
    }

    try {
        console.log(`Uploading ${fileName} to Cloudinary...`);
        const fileData = fs.readFileSync(filePath);
        const base64Image = `data:image/png;base64,${fileData.toString('base64')}`;
        const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            file: base64Image,
            upload_preset: UPLOAD_PRESET,
            folder: "products"
        });
        return res.data.secure_url;
    } catch (err) {
        console.error(`Failed to upload ${fileName} to Cloudinary: ${err.message}`);
        return null;
    }
}

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        // Fetch categories dynamically
        const categories = await Category.find({});
        const getCategoryId = (nameEn, fallbackId) => {
            const cat = categories.find(c => c.name?.en === nameEn);
            return cat ? cat._id : fallbackId;
        };

        const napierGrassId = getCategoryId("Napier Grass", "69e8aee11f3eea65a16310de");
        const organicSeedsId = getCategoryId("Organic Seeds", "69e8aee41f3eea65a16310e0");
        const drumSeedsId = getCategoryId("Drum Seeds", "69e8aee01f3eea65a16310dc");

        // Upload images to Cloudinary
        const smallNapierImg = await uploadImage("napier-grass.png");
        const hedgeLucerneImg = await uploadImage("seeds-package-removebg-Hedge-Lucerne.png");
        const moringaImg = await uploadImage("drum-seeds.png");
        const agathiImg = await uploadImage("seeds-package-removebg-preview.png");
        const soundalImg = await uploadImage("seeds-package-removebg-leucaena.png");

        const productsData = [
            {
                productId: "101",
                name: {
                    en: "Super Napier",
                    ta: "சூப்பர் நேப்பியர்",
                    hi: "सुपर नेपियर",
                    te: "సూపర్ నేపియర్",
                    kn: "ಸೂಪರ್ ನೇಪಿಯರ್",
                    ml: "സൂപ്പർ നേപ്പിയർ"
                },
                description: {
                    en: "Super Napier (Pakchong 1) is a high-yielding hybrid Napier grass developed in Thailand. It yields up to 180 to 200 tons of green fodder per acre per year, has high protein content (14% - 18%), and sweet juicy stems.",
                    ta: "சூப்பர் நேப்பியர் (Pakchong1) என்பது அதிக மகசூல் தரக்கூடிய ஒட்டுப்புல் ரகமாகும். இது வருடத்திற்கு ஏக்கருக்கு 180 முதல் 200 டன் வரை தீவன மகசூல் தரக்கூடியது. இதில் 14% முதல் 18% வரை புரதச்சத்து உள்ளது. இதன் தண்டுப்பகுதி கரும்பு போல் இனிப்பாக இருக்கும்.",
                    hi: "सुपर नेपियर (Pakchong 1) एक उच्च उपज देने वाली संकर नेपियर घास है। यह प्रति वर्ष प्रति एकड़ 180 से 200 टन हरा चारा पैदा करती है, इसमें 14% से 18% तक उच्च प्रोटीन सामग्री होती है और तना मीठा व रसीला होता है।",
                    te: "సూపర్ నేపియర్ (Pakchong 1) అనేది అధిక దిగుబడిని ఇచ్చే హైబ్రిడ్ నేపియర్ గడ్డి. ఇది ఒక సంవత్సరంలో ఒక ఎకరాకి 180-200 టన్నుల పశుగ్రాసాన్ని ఇస్తుంది, ఇందులో 14% - 18% వరకు ప్రోటీన్ ఉంటుంది మరియు కాండం తియ్యగా ఉంటుంది.",
                    kn: "ಸೂಪర్ ನೇಪಿಯర్ (Pakchong 1) ಹೆಚ್ಚು ಇಳುವರಿ ನೀಡುವ ಹೈಬ్రిಡ್ ನೇಪಿಯರ್ ಹುಲ್ಲು. ಇದು ವರ್ಷಕ್ಕೆ ಎಕರೆಗೆ 180 ರಿಂದ 200 ಟನ್ ಹಸಿరు ಮೇವನ್ನು ನೀಡುತ್ತದೆ, ಇದರಲ್ಲಿ 14% ರಿಂದ 18% ರಷ್ಟು ಹೆಚ್ಚಿನ ಪ್ರೋಟೀൻ ಅಂಶವಿರುತ್ತದೆ ಮತ್ತು కాండ ಸಿಹಿಯಾಗಿರುತ್ತದೆ.",
                    ml: "സൂപ്പർ നേപ്പിയർ (Pakchong 1) ഉയർന്ന വിളവ് നൽകുന്ന ഒരു സങ്കരയിനം നേപ്പിയർ പുല്ലാണ്. ഇത് ഒരേക്കറിൽ പ്രതിവർഷം 180 മുതൽ 200 ടൺ വരെ പച്ചപ്പുല്ല് നൽകുന്നു. ഇതിൽ 14% മുതൽ 18% വരെ ഉയർന്ന പ്രോട്ടീൻ അടങ്ങിയിരിക്കുന്നു, തണ്ടുകൾക്ക് കരിമ്പിന്റെ മധുരവുമുണ്ട്."
                },
                category: napierGrassId,
                status: "Active",
                // Preserve existing highlights and steps if they already exist, otherwise we upsert below
            },
            {
                productId: "103",
                name: {
                    en: "Small Napier / Dwarf Napier",
                    ta: "சுமால் நேப்பியர்",
                    hi: "स्मॉल नेपियर / बौना नेपियर",
                    te: "స్మాల్ నేపియర్",
                    kn: "ಸ್ಮಾಲ್ ನೇಪಿಯர்",
                    ml: "സ്മോൾ നേപ്പിയർ"
                },
                description: {
                    en: "Small Napier or Dwarf Napier is a perennial fodder grass suitable for cows, goats, and sheep. It has excellent resistance to pests and diseases, high leaf-to-stem ratio, and can be harvested every 45 days after the first cut.",
                    ta: "சுமால் நேப்பியர் அல்லது குள்ள நேப்பியர் என்பது ஆடு, மாடுகளுக்கு ஏற்ற ஒரு பல்லாண்டு தீவனப்புல் ஆகும். இது பூச்சி மற்றும் நோய் எதிர்ப்புத் திறன் கொண்டது, அதிக இலைகளைக் கொண்டது மற்றும் நடவு செய்த 45 நாட்களுக்கு ஒருமுறை அறுவடை செய்யக்கூடியது.",
                    hi: "स्मॉल नेपियर या बौना नेपियर एक बहुवर्षीय चारा घास है जो गायों, बकरियों और भेड़ों के लिए उपयुक्त है। इसमें कीटों और बीमारियों के प्रति उत्कृष्ट प्रतिरोधक क्षमता होती है और इसे पहली कटाई के बाद हर 45 दिनों में काटा जा सकता है।",
                    te: "స్మాల్ నేపియర్ లేదా డ్వార్ఫ్ నేపియర్ అనేది ఆవులు, మేకలు మరియు గొర్రెలకు సరిపోయే ఒక బహువార్షిక పశుగ్రాసం. ఇది క్రిములు మరియు తెగుళ్లను సమర్థవంతంగా తట్టుకుంటుంది మరియు ప్రతి 45 రోజులకు ఒకసారి దీనిని కోయవచ్చు.",
                    kn: "ಸ್ಮಾಲ್ ನೇಪಿಯರ್ ಅಥವಾ ಕುಬ್ಜ ನೇಪಿಯರ್ ಎಂಬುದು ಹಸುಗಳು, ಕುರಿ ಮತ್ತು मೇಕೆಗಳಿಗೆ ಸೂಕ್ತವಾದ ಬಹುವರ್ಷಿ ಮೇವು ಹುಲ್ಲು. ಇದು ಕೀಟ ಮತ್ತು ರೋಗ ನಿರೋಧಕ ಶಕ್ತಿಯನ್ನು ಹೊಂದಿದೆ ಮತ್ತು ಮೊದಲ ಕೊಯ್ಲಿನ ನಂತರ ಪ್ರತಿ 45 ದಿನಗಳಿಗೊಮ್ಮೆ ಕೊಯ್ಯಬಹುದು.",
                    ml: "സ്മോൾ നേപ്പിയർ അഥവാ ഡ്വാർഫ് നേപ്പിയർ കന്നുകാലികൾക്കും ആടുകൾക്കും അനുയോജ്യമായ ഒരു ബഹുവർഷി തീറ്റപ്പുല്ലാണ്. ഇത് കീടങ്ങളേയും രോഗങ്ങളേയും പ്രതിരോധിക്കുന്നു, കൂടാതെ ആദ്യ വിളവെടുപ്പിന് ശേഷം ഓരോ 45 ദിവസത്തിലും വിളവെടുക്കാം."
                },
                category: napierGrassId,
                images: smallNapierImg ? [smallNapierImg] : [],
                unit: "piece",
                weightOptions: [
                    { weight: 500, price: 500, discountPrice: 1000, unit: "piece", stock: 1000 },
                    { weight: 1000, price: 950, discountPrice: 2000, unit: "piece", stock: 1000 },
                    { weight: 5000, price: 4500, discountPrice: 10000, unit: "piece", stock: 1000 },
                    { weight: 10000, price: 8500, discountPrice: 20000, unit: "piece", stock: 1000 }
                ],
                SKU: "sp103",
                shippingNormalTN: 50,
                shippingExpressTN: 60,
                shippingNormalOutside: 100,
                shippingExpressOutside: 180,
                status: "Active"
            },
            {
                productId: "104",
                name: {
                    en: "Hedge Lucerne (Desmanthus)",
                    ta: "வேலிமசால் (Hedge Lucerne)",
                    hi: "हेज ल्यूसर्न (डेसमैंथस)",
                    te: "హెడ్జ్ లూసర్న్",
                    kn: "ಹೆಡ್ಜ್ ಲ್ಯೂಸರ್ನ್",
                    ml: "ഹെഡ്ജ് ലൂസേൺ (ഡെസ്മാന്തസ്)"
                },
                description: {
                    en: "Hedge Lucerne (Desmanthus virgatus) is a perennial leguminous fodder crop containing 20% to 22% crude protein. Highly palatable for goats, sheep, and cattle, it yields up to 40 tons of green fodder per acre per year under irrigation.",
                    ta: "வேலிமசால் (Desmanthus virgatus) என்பது 20% முதல் 22% வரை புரதச்சத்து கொண்ட ஒரு பல்லாண்டு பயறுவகை தீவனமாகும். இது ஆடு, மாடுகளுக்கு மிகவும் உகந்தது, மேலும் நீர்ப்பாசன வசதியுடன் வருடத்திற்கு ஏக்கருக்கு 40 டன் பசுந்தீவனம் வழங்கும்.",
                    ml: "ഹെഡ്ജ് ലൂസേൺ (ഡെസ്മാന്തസ് വിർഗാറ്റസ്) 20% മുതൽ 22% വരെ പ്രോട്ടീൻ അടങ്ങിയ ഒരു ബഹുവർഷി പയറുവർഗ്ഗ തീറ്റവിളയാണ്. ഇത് ആടുകൾക്കും പശുക്കൾക്കും വളരെ പ്രിയപ്പെട്ടതാണ്, കൂടാതെ ജലസേചനത്തിലൂടെ പ്രതിവർഷം ഏക്കറിന് 40 ടൺ പച്ചപ്പുല്ല് നൽകുന്നു.",
                    hi: "हेज ल्यूसर्न (डेसमैंथस विरगाटस) एक बहुवर्षीय फलदार चारा फसल है जिसमें 20% से 22% कच्चा प्रोटीन होता है। यह बकरियों, भेड़ों और मवेशियों के लिए अत्यधिक स्वादिष्ट है।",
                    te: "హెడ్జ్ లూసర్న్ (డెస్మాంతస్ విర్గాటస్) అనేది 20% నుండి 22% వరకు ప్రోటీన్ కలిగిన ఒక బహువార్షిక పప్పుధాన్యాల పశుగ్రాసం. ఇది మేకలు, గొర్రెలు మరియు ఆవులకు చాలా ఉపయోగకరం.",
                    kn: "ಹೆಡ್ಜ್ ಲ್ಯೂಸರ್ನ್ (ಡೆಸ್ಮಾಂತಸ್ ವಿರ್ಗಾಟಸ್) ಎಂಬುದು 20% ರಿಂದ 22% ಪ್ರೋಟೀನ್ ಹೊಂದಿರುವ ಬಹುವರ್ಷಿ ದ್ವಿದಳ ಧாನ್ಯ ಮೇವು ಬೆಳೆಯಾಗಿದೆ. ಇದು ಮೇಕೆ, ಕುರಿ ಮತ್ತು ಹಸುಗಳಿಗೆ ಅತ್ಯಂತ ರುಚಿಕರವಾದ ಮೇವಾಗಿದೆ."
                },
                category: organicSeedsId,
                images: hedgeLucerneImg ? [hedgeLucerneImg] : [],
                unit: "kg",
                weightOptions: [
                    { weight: 1, price: 450, discountPrice: 600, unit: "kg", stock: 500 },
                    { weight: 2, price: 850, discountPrice: 1200, unit: "kg", stock: 500 },
                    { weight: 5, price: 2000, discountPrice: 3000, unit: "kg", stock: 500 },
                    { weight: 8, price: 3100, discountPrice: 4800, unit: "kg", stock: 500 }
                ],
                SKU: "hl104",
                shippingNormalTN: 50,
                shippingExpressTN: 60,
                shippingNormalOutside: 100,
                shippingExpressOutside: 180,
                status: "Active"
            },
            {
                productId: "105",
                name: {
                    en: "Moringa / Drumstick Seeds",
                    ta: "முருங்கை விதைகள்",
                    hi: "सहजन के बीज (मोरिंगा)",
                    te: "మునగ గింజలు (మోరింగా)",
                    kn: "ನುಗ್ಗೆ ಬೀಜಗಳು (ಮೊರಿಂಗಾ)",
                    ml: "മുരിങ്ങ വിത്തുകൾ"
                },
                description: {
                    en: "High-quality Moringa Oleifera (Drumstick) seeds for planting. Yields 35 to 40 tons of green fodder per year as livestock feed. The tree leaves are extremely nutritious, protein-rich, and serve as an excellent supplement for farm animals.",
                    ta: "உயர்தர முருங்கை விதைகள் சாகுபடிக்கு உகந்தது. கால்நடைத் தீவனமாக வருடத்திற்கு 35 முதல் 40 டன் பசுந்தீவனம் தருகிறது. இதன் இலைகள் அதிக ஊட்டச்சத்தும் புரதச்சத்தும் நிறைந்து விளங்குவதால் கால்நடைகளுக்குச் சிறந்த உணவாகிறது.",
                    ml: "ഉയർന്ന ഗുണനിലവാരമുള്ള മുരിങ്ങ വിത്തുകൾ. കന്നുകാലിത്തീറ്റയായി പ്രതിവർഷം 35 മുതൽ 40 ടൺ വരെ ഉയർന്ന വിളവ് നൽകുന്നു. മുരിങ്ങയില കന്നുകാലികൾക്ക് വളരെ പോഷകപ്രദവും മാംസ്യം നിറഞ്ഞതുമാണ്.",
                    hi: "रोपण के लिए उच्च गुणवत्ता वाले सहजन (मोरिंगा) के बीज। पशुओं के चारे के रूप में प्रति वर्ष 35 से 40 टन हरा चारा मिलता है। इसकी पत्तियां प्रोटीन और पोषक तत्वों से भरपूर होती हैं।",
                    te: "నాటడానికి నాణ్యమైన మునగ గింజలు. పశువుల గ్రాసంగా ఏడాదికి 35 నుండి 40 టన్నుల వరకు పచ్చి మేత లభిస్తుంది. దీని ఆకులలో ప్రోటీన్ మరియు పోషకాలు పుష్కలంగా ఉంటాయి.",
                    kn: "ಕೃಷಿಗೆ ಉತ್ತಮ ಗುಣమಟ್ಟದ नुಗ್ಗೆ ಬೀಜಗಳು. ಜಾನುವಾರು ಮೇವಾಗಿ ವರ್ಷಕ್ಕೆ 35 ರಿಂದ 40 ಟನ್ ಹಸಿರು ಮೇವನ್ನು ನೀಡುತ್ತದೆ. ಇದರ ಎಲೆಗಳು ಅತ್ಯಂತ ಪೌಷ್ಟಿಕ ಮತ್ತು ಪ್ರೋಟೀನ್ ಭರಿತವಾಗಿವೆ."
                },
                category: drumSeedsId,
                images: moringaImg ? [moringaImg] : [],
                unit: "kg",
                weightOptions: [
                    { weight: 100, price: 200, discountPrice: 300, unit: "g", stock: 300 },
                    { weight: 250, price: 450, discountPrice: 600, unit: "g", stock: 300 },
                    { weight: 500, price: 800, discountPrice: 1200, unit: "g", stock: 300 },
                    { weight: 1, price: 1500, discountPrice: 2200, unit: "kg", stock: 300 }
                ],
                SKU: "ms105",
                shippingNormalTN: 50,
                shippingExpressTN: 60,
                shippingNormalOutside: 100,
                shippingExpressOutside: 180,
                status: "Active"
            },
            {
                productId: "106",
                name: {
                    en: "Agathi Seeds (Sesbania Grandiflora)",
                    ta: "அகத்தி விதைகள் (Sesbania Grandiflora)",
                    hi: "अगस्त्य के बीज (अगाथी)",
                    te: "అవిసె గింజలు (అగతి)",
                    kn: "ಅಗಸೆ ಬೀಜಗಳು (ಅಗತಿ)",
                    ml: "ആഗതി വിത്തുകൾ (സെസ്ബാനിയ ഗ്രാൻഡിഫ്ലോറ)"
                },
                description: {
                    en: "Agathi (Sesbania Grandiflora), known as the 'Queen of Greens', is a fast-growing tree fodder crop containing about 25% protein. The leaves are a favorite and highly preferred feed for cows, goats, and sheep, producing up to 100 tonnes of green fodder per hectare per year.",
                    ta: "அகத்தி (Sesbania Grandiflora) சுமார் 25% புரதச்சத்து கொண்ட ஒரு வேகமான மரவகைத் தீவனமாகும். இதன் கீரை மாடு மற்றும் ஆடுகளுக்கு மிகவும் பிடித்தமான உணவாகும், மேலும் ஒரு ஹெக்டேருக்கு வருடத்திற்கு 100 டன் பசுந்தீவனம் வழங்கும்.",
                    ml: "ആഗതി (സെസ്ബാനിയ ഗ്രാൻഡിഫ്ലോറ) 25% പ്രോട്ടീൻ അടങ്ങിയ വേഗത്തിൽ വളരുന്ന ഒരു വൃക്ഷ തീറ്റവിളയാണ്. ഇതിന്റെ ഇലകൾ ആടുകൾക്കും പശുക്കൾക്കും ഏറ്റവും പ്രിയപ്പെട്ടതാണ്, കൂടാതെ ഒരു ഹെക്ടറിൽ നിന്ന് പ്രതിവർഷം 100 ടൺ പച്ചപ്പുല്ല് നൽകുന്നു.",
                    hi: "अगाथी (सेसबानिया ग्रैंडिफ्लोरा) एक तेजी से बढ़ने वाली फलदार चारा फसल है जिसमें लगभग 25% प्रोटीन होता है। इसकी पत्तियां गायों, बकरियों और भेड़ों के लिए अत्यधिक पसंद की जाती हैं।",
                    te: "అవిసె (సెస్బానియా గ్రాండిఫ్లోరా) అనేది దాదాపు 25% ప్రోటీన్ కలిగిన ఒక వేగంగా పెరిగే చెట్టు రకం పశుగ్రాసం. ఇది ఆవులు, మేక్కలకు ఇష్టమైన మేత.",
                    kn: "ಅಗಸೆ (ಸೆಸ್ಬೇನಿಯಾ ಗ್ರಾಂಡಿಫ್ಲೋರಾ) ಎಂಬುದು ಸುಮಾರು 25% ಪ್ರೋಟೀൻ ಹೊಂದಿರುವ ವೇಗವಾಗಿ ಬೆಳೆಯುವ ಮೇವು ಬೆಳೆಯಾಗಿದೆ. ಇದರ ಎಲೆಗಳು ಹಸು ಮತ್ತು ಮೇಕೆಗಳಿಗೆ ಅತ್ಯಂತ ಪ್ರಿಯವಾದ ಮೇವಾಗಿದೆ."
                },
                category: organicSeedsId,
                images: agathiImg ? [agathiImg] : [],
                unit: "kg",
                weightOptions: [
                    { weight: 1, price: 400, discountPrice: 550, unit: "kg", stock: 500 },
                    { weight: 2, price: 750, discountPrice: 1100, unit: "kg", stock: 500 },
                    { weight: 5, price: 1800, discountPrice: 2700, unit: "kg", stock: 500 },
                    { weight: 8, price: 2800, discountPrice: 4200, unit: "kg", stock: 500 }
                ],
                SKU: "as106",
                shippingNormalTN: 50,
                shippingExpressTN: 60,
                shippingNormalOutside: 100,
                shippingExpressOutside: 180,
                status: "Active"
            },
            {
                productId: "107",
                name: {
                    en: "Soundal Seeds (Subabul / Leucaena)",
                    ta: "சௌண்டல் விதைகள் (சுபாபுல்)",
                    hi: "सुबबूल के बीज (सौंदल)",
                    te: "సుబాబుల్ గింజలు",
                    kn: "ಸುಬಾಬುಲ್ ಬೀಜಗಳು",
                    ml: "സൗണ്ടാൽ വിത്തുകൾ (സുബാബുൽ)"
                },
                description: {
                    en: "Soundal or Subabul (Leucaena leucocephala) is a drought-tolerant perennial tree fodder crop. It yields 80 to 100 tons of nutritious green fodder per year under irrigated conditions and is an excellent source of protein for livestock.",
                    ta: "சௌண்டல் அல்லது சுபாபுல் (Leucaena leucocephala) என்பது வறட்சியைத் தாங்கி வளரும் பல்லாண்டு மரவகைத் தீவனமாகும். நீர்ப்பாசன வசதியுடன் வருடத்திற்கு ஏக்கருக்கு 80 முதல் 100 டன் வரை சத்தான பசுந்தீவனம் தரக்கூடியது.",
                    ml: "സൗണ്ടാൽ അഥവാ സുബാബുൽ (ല്യൂക്കാനിയ ല്യൂക്കോസെഫാല) വരൾച്ചയെ അതിജീവിക്കുന്ന ഒരു വൃക്ഷ തീറ്റവിളയാണ്. ജലസേചനത്തിലൂടെ പ്രതിവർഷം 80-100 ടൺ പോഷകസമൃദ്ധമായ പച്ചപ്പുല്ല് ഇത് നൽകുന്നു.",
                    hi: "सुबबूल (ल्यूकेना ल्यूकोसेफला) सूखा-सहिष्णु बहुवर्षीय चारा फसल है। यह सिंचित परिस्थितियों में प्रति वर्ष 80 से 100 टन हरा चारा देती है।",
                    te: "సుబాబుల్ (ల్యూకాన్ ల్యూకోసెఫాలా) అనేది కరువును తట్టుకునే బహువార్షిక చెట్టు రకం పశుగ్రాసం. ఇది ఏడాదికి 80 నుండి 100 టన్నుల వరకు పచ్చి మేతను ఇస్తుంది.",
                    kn: "ಸುಬಾಬುಲ್ (ಲ್ಯೂಕೇನಾ ಲ್ಯೂಕೋಸೆಫಾಲಾ) ಎಂಬುದು ಬರನಿರೋಧಕ ಬಹುವರ್ಷಿ ಮೇವು ಬೆಳೆಯಾಗಿದೆ. ಇದು ವರ್ಷಕ್ಕೆ 80 ರಿಂದ 100 ಟನ್ ಪೌಷ್ಟಿಕ ಹಸಿರು ಮೇವನ್ನು ನೀಡುತ್ತದೆ."
                },
                category: organicSeedsId,
                images: soundalImg ? [soundalImg] : [],
                unit: "kg",
                weightOptions: [
                    { weight: 1, price: 350, discountPrice: 500, unit: "kg", stock: 500 },
                    { weight: 2, price: 650, discountPrice: 950, unit: "kg", stock: 500 },
                    { weight: 5, price: 1500, discountPrice: 2200, unit: "kg", stock: 500 },
                    { weight: 8, price: 2300, discountPrice: 3500, unit: "kg", stock: 500 }
                ],
                SKU: "ss107",
                shippingNormalTN: 50,
                shippingExpressTN: 60,
                shippingNormalOutside: 100,
                shippingExpressOutside: 180,
                status: "Active"
            }
        ];

        for (const data of productsData) {
            const existingProduct = await Product.findOne({ productId: data.productId });
            if (existingProduct) {
                console.log(`Updating existing product ${data.productId} (${data.name.en})...`);
                existingProduct.name = data.name;
                existingProduct.description = data.description;
                existingProduct.category = data.category;
                if (data.images && data.images.length > 0) {
                    existingProduct.images = data.images;
                }
                if (data.weightOptions) existingProduct.weightOptions = data.weightOptions;
                if (data.unit) existingProduct.unit = data.unit;
                existingProduct.status = data.status;
                await existingProduct.save();
            } else {
                console.log(`Creating new product ${data.productId} (${data.name.en})...`);
                await Product.create(data);
            }
        }

        console.log("Seeding complete!");
        process.exit(0);
    } catch (err) {
        console.error("Seeding error:", err);
        process.exit(1);
    }
}

seed();
