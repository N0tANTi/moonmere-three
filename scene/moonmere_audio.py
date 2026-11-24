"""Write the original stereo pond ambience from filtered noise and droplet tones."""
import wave

import numpy as np


def write_ambience(path, seconds=10):
    rate = 48000
    rng = np.random.default_rng(2368)
    n = int(rate*seconds)
    t = np.arange(n)/rate
    frequency = np.fft.rfftfreq(n,1/rate)

    def band(center, width):
        spectrum = np.fft.rfft(rng.standard_normal(n))
        response = np.exp(-.5*(np.log(np.maximum(frequency,1)/center)/width)**2)
        sound = np.fft.irfft(spectrum*response,n)
        return sound / max(1e-6,sound.std())

    wash = band(790, .74)
    breeze = band(145, .57)
    right = band(2100,.50)
    left = band(2050,.50)
    base = .027*wash*(.84+.16*np.sin(2*np.pi*.30*t)) + .012*breeze
    stereo = np.column_stack([base+.014*left,base+.014*right])
    # The cascade stays on the listener's right; the nearest drops move between banks.
    stereo[:,1] += .009*band(4800,.43)
    for onset in (.44,1.81,2.05,3.25,4.76,5.02,6.68,7.86,8.04,9.22):
        u = np.arange(int(.27*rate))/rate
        pitch = rng.uniform(440,940)
        tone = np.sin(2*np.pi*(pitch*u+pitch*.14*(1-np.exp(-u*35))/35))
        drop = .060*tone*np.exp(-u*28)*(1-np.exp(-u*180))
        start = int(onset*rate)
        stereo[start:start+len(u)] += drop[:,None]*rng.uniform(.40,.98,(1,2))
    for offset,pan in [(1.09,.19),(5.63,.84),(7.02,.75)]:
        for pulse in range(4):
            start = int((offset+pulse*.083)*rate)
            u = np.arange(int(.046*rate))/rate
            tick = .013*np.sin(np.pi*u/u[-1])**2*np.sin(2*np.pi*(3120*u+5600*u*u))
            stereo[start:start+len(u)] += tick[:,None]*np.array([1-pan,pan])
    edge = np.minimum(np.minimum(t/.35,(seconds-t)/.62),1)
    stereo *= np.clip(edge,0,1)[:,None]
    with wave.open(str(path),"wb") as out:
        out.setparams((2,2,rate,0,"NONE","not compressed"))
        out.writeframes((np.clip(stereo,-1,1)*32767).astype("<i2").tobytes())
