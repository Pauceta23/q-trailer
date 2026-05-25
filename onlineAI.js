import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1';

const helpBtn = document.getElementById("help");
const askQuestion = await pipeline(
    'question-answering',
    'iagovar/roberta-base-bne-sqac-onnx'
);
const TOTAL_HELPS = 3;
let numHelps = TOTAL_HELPS;
let alreadyClicked = false;

helpBtn.innerText = `Ayuda (${numHelps} / ${TOTAL_HELPS})`;

helpBtn.addEventListener("click", async () => {
    if (numHelps > 0 && !alreadyClicked){
        helpBtn.innerText = "Cargando...";
        alreadyClicked = true;

        const title = document.getElementById("overlay-movie").innerText;
        const question = document.getElementById("overlay-question").innerText;
        const context = (() => {
            for (const q of quizQuestions) {
                if (q.movie.toLowerCase() === title.toLowerCase()){
                    return q.fun_fact;
                }
            }
        })();

        const answer = await askQuestion(question, context);
        numHelps -= 1;

        helpBtn.innerText = "Ayuda generada por IA: " + answer.answer;

        setTimeout(() => {
            helpBtn.innerHTML = `Ayuda (${numHelps} / ${TOTAL_HELPS})`;
            alreadyClicked = false;
        }, 10000);
    }
    else if (numHelps <= 0){
        helpBtn.innerHTML = "<i>¡Ayudas agotadas!</i>";
    }
    
});