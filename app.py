from flask import Flask, request, render_template, jsonify
import os
import speech_recognition as SR
from pydub import AudioSegment
import nltk
from nltk.tokenize import sent_tokenize

app = Flask(__name__, static_url_path='/static')

def check_audio_format(file_path):
    try:
        audio = AudioSegment.from_file(file_path)
        print(f'Audio format: {audio.format}')
    except Exception as e:
        print(f'Error reading audio file: {str(e)}')

def split_audio(file_path, segment_length):
    audio = AudioSegment.from_file(file_path)
    segments = []
    for i in range(0, len(audio), segment_length * 1000):
        segments.append(audio[i:i + segment_length * 1000])
    return segments

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audioBlob' not in request.files and 'audioFile' not in request.files:
        return 'No se encontró el archivo de audio'

    file = request.files.get('audioBlob') or request.files.get('audioFile')

    if file.filename == '':
        return 'No file selected'

    try:
        file_ext = os.path.splitext(file.filename)[1].lower()
        audio_path_with_ext = os.path.join('uploads', file.filename)
        print(f'Saving file to: {audio_path_with_ext}')
        file.save(audio_path_with_ext)

        check_audio_format(audio_path_with_ext)

        if file_ext != '.wav':
            try:
                audio = AudioSegment.from_file(audio_path_with_ext)
                audio_path_wav = os.path.splitext(audio_path_with_ext)[0] + '.wav'
                audio.export(audio_path_wav, format="wav")
                audio_path = audio_path_wav
                print(f'Converted file to: {audio_path}')
            except Exception as e:
                return f'Error converting audio file: {str(e)}'
        else:
            audio_path = audio_path_with_ext

        # Dividir el audio en segmentos de 60 segundos
        segments = split_audio(audio_path, 60)

        recognizer = SR.Recognizer()
        transcript = ""

        for i, segment in enumerate(segments):
            segment_path = f"{audio_path}_segment_{i}.wav"
            segment.export(segment_path, format="wav")

            # Leer el archivo de audio segmentado
            with SR.AudioFile(segment_path) as source:
                audio_data = recognizer.record(source)
                
            try:
                # Realizar la transcripción
                segment_transcript = recognizer.recognize_google(audio_data, language='es-ES')
                transcript += segment_transcript + " "
            except SR.UnknownValueError:
                transcript += "[Inaudible] "
            except SR.RequestError:
                transcript += "[Error de reconocimiento] "

        print(f'Transcription: {transcript}')

        # Guardar la transcripción en un archivo de texto
        with open('transcriptions.txt', 'a', encoding='utf-8') as f:
            f.write(transcript.strip() + '\n')

        return transcript.strip()

    except Exception as e:
        return f'Error: {str(e)}'

@app.route('/chatbot', methods=['POST'])
def chatbot():
    question = request.json.get('question', '').lower()

    if not question:
        return jsonify({'answer': 'Por favor, haga una pregunta.'})

    with open('transcriptions.txt', 'r', encoding='utf-8') as f:
        transcriptions = f.read()

    sentences = sent_tokenize(transcriptions)
    relevant_sentences = [sentence for sentence in sentences if question in sentence.lower()]

    if relevant_sentences:
        answer = ' '.join(relevant_sentences[:5])
    else:
        answer = 'No tengo información sobre eso en las transcripciones.'

    return jsonify({'answer': answer})

if __name__ == '__main__':
    if not os.path.exists('uploads'):
        os.makedirs('uploads')
    nltk.download('punkt')
    app.run(debug=True)
