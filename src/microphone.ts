const ANALYSER_FFT = 2048;
const ANALYSER_BASE = 128.0;

export const Microphone = async () => {
  if (!('getUserMedia' in navigator.mediaDevices)) {
    throw Error('MediaDevices.getUserMedia() not supported on your browser!');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = ANALYSER_FFT;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    source.connect(analyser);

    const getVolume = () => {
      analyser.getFloatTimeDomainData(dataArray);
      const maxInput = Math.max(...dataArray);
      return maxInput;
    }

    return {
      getVolume
    }
  } catch (error) {
    console.log("Unable to initialize microphone module. The following error occured: " + error);
  }
}
