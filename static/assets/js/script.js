document.addEventListener('DOMContentLoaded', function() {
    const uploadAudioBtn = document.getElementById('uploadAudioBtn');
    const recordAudioBtn = document.getElementById('recordAudioBtn');
    const uploadForm = document.getElementById('audioForm');
    const recordForm = document.getElementById('recordForm');
    const result = document.getElementById('result');
    const startRecordingBtn = document.getElementById('startRecording');
    const stopRecordingBtn = document.getElementById('stopRecording');
    const recordingStatus = document.getElementById('recordingStatus');
    const avatarContainer = document.getElementById('avatarContainer');

    const avatarAnimation = lottie.loadAnimation({
        container: avatarContainer,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        path: '/static/assets/img/Animation.json' 
    });

    // Inicialmente ocultar los formularios
    uploadForm.style.display = 'none';
    recordForm.style.display = 'none';

    // Mostrar el formulario de subir archivo
    uploadAudioBtn.addEventListener('click', function() {
        uploadForm.style.display = 'block';
        recordForm.style.display = 'none';
    });

    recordAudioBtn.addEventListener('click', function() {
        uploadForm.style.display = 'none';
        recordForm.style.display = 'block';
    });

    document.getElementById('audioForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData();
        formData.append('audioFile', document.getElementById('audioFile').files[0]);

        fetch('/transcribe', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(resultText => {
            showTranscription(resultText);
        })
        .catch(error => {
            console.error('Error:', error);
            result.innerText = 'Error processing the transcript.';
        });
    });

    // Manejo de la grabación de audio
    let mediaRecorder;
    let audioChunks = [];

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        startRecordingBtn.addEventListener('click', function() {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    try {
                        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                    } catch (e) {
                        console.warn('audio/webm not supported, using default MIME type');
                        mediaRecorder = new MediaRecorder(stream);
                    }

                    mediaRecorder.ondataavailable = event => {
                        audioChunks.push(event.data);
                    };

                    mediaRecorder.onstop = function() {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const formData = new FormData();
                        formData.append('audioBlob', audioBlob, 'recorded-audio.webm');

                        fetch('/transcribe', {
                            method: 'POST',
                            body: formData
                        })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Network response was not ok');
                            }
                            return response.text();
                        })
                        .then(resultText => {
                            showTranscription(resultText);
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            result.innerText = 'Error processing the recording.';
                        });

                        audioChunks = [];
                        recordingStatus.innerText = 'Recording Completed.';
                    };

                    mediaRecorder.start();
                    startRecordingBtn.disabled = true;
                    stopRecordingBtn.disabled = false;
                    recordingStatus.innerText = 'Recording...';
                })
                .catch(error => {
                    console.error('Error accessing microphone:', error);
                    recordingStatus.innerText = 'Error starting recording: ' + error.message;
                });
        });

        stopRecordingBtn.addEventListener('click', function() {
            if (mediaRecorder) {
                mediaRecorder.stop();
                startRecordingBtn.disabled = false;
                stopRecordingBtn.disabled = true;
                recordingStatus.innerText = 'Stopped.';
            }
        });
    } else {
        console.error('getUserMedia not supported on this browser.');
        recordingStatus.innerText = 'The browser does not support audio recording.';
    }

    // Función para mostrar el texto transcrito y reproducir la voz
    function showTranscription(transcription) {
        // Puntuación básica de la transcripción
        transcription = transcription.replace(/(Hola|Adiós|Hola,|Adiós,|[.?!])\s*/g, '$1\n');
        transcription = transcription.replace(/(\b\d{1,3})(\d{3})(\b)/g, '$1,$2');
        transcription = transcription.replace(/([a-z])([A-Z])/g, '$1. $2');
        
        result.innerText = transcription;

        responsiveVoice.speak(transcription, "Spanish Latin American Female", {
            onstart: function() {
                avatarAnimation.goToAndPlay(0, true);
            },
            onend: function() {
                avatarAnimation.stop();
            }
        });
    }
});
