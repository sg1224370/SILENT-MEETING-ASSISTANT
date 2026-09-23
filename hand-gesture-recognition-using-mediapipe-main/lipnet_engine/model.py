# -*- coding: utf-8 -*-
"""
PyTorch Implementation of LipNet architecture matching rizkiarm/LipNet Keras model2.py
Loads Keras HDF5 weights directly for high performance CPU/GPU inference.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import h5py
import numpy as np


class KerasGRUCell(nn.Module):
    def __init__(self, kernel, recurrent_kernel, bias):
        super().__init__()
        input_size, hidden_3 = kernel.shape
        hidden_size = recurrent_kernel.shape[0]
        self.hidden_size = hidden_size
        
        # Keras GRU weight slicing: z (update), r (reset), h (candidate)
        self.W_z = torch.from_numpy(kernel[:, :hidden_size]).float()
        self.W_r = torch.from_numpy(kernel[:, hidden_size:2*hidden_size]).float()
        self.W_h = torch.from_numpy(kernel[:, 2*hidden_size:]).float()

        self.U_z = torch.from_numpy(recurrent_kernel[:, :hidden_size]).float()
        self.U_r = torch.from_numpy(recurrent_kernel[:, hidden_size:2*hidden_size]).float()
        self.U_h = torch.from_numpy(recurrent_kernel[:, 2*hidden_size:]).float()

        self.b_z = torch.from_numpy(bias[:hidden_size]).float()
        self.b_r = torch.from_numpy(bias[hidden_size:2*hidden_size]).float()
        self.b_h = torch.from_numpy(bias[2*hidden_size:]).float()

    def forward(self, x, reverse=False):
        T = x.shape[0]
        h = torch.zeros(self.hidden_size, dtype=torch.float32, device=x.device)
        outputs = []
        indices = range(T - 1, -1, -1) if reverse else range(T)
        for t in indices:
            xt = x[t]
            z = torch.sigmoid(torch.matmul(xt, self.W_z) + torch.matmul(h, self.U_z) + self.b_z)
            r = torch.sigmoid(torch.matmul(xt, self.W_r) + torch.matmul(h, self.U_r) + self.b_r)
            hh = torch.tanh(torch.matmul(xt, self.W_h) + torch.matmul(r * h, self.U_h) + self.b_h)
            h = z * h + (1.0 - z) * hh
            outputs.append(h)
        if reverse:
            outputs.reverse()
        return torch.stack(outputs, dim=0)


class KerasBidirectionalGRU(nn.Module):
    def __init__(self, f_kernel, f_rec, f_bias, b_kernel, b_rec, b_bias):
        super().__init__()
        self.forward_gru = KerasGRUCell(f_kernel, f_rec, f_bias)
        self.backward_gru = KerasGRUCell(b_kernel, b_rec, b_bias)

    def forward(self, x):
        out_f = self.forward_gru(x, reverse=False)
        out_b = self.backward_gru(x, reverse=True)
        return torch.cat([out_f, out_b], dim=-1)


class LipNet(nn.Module):
    def __init__(self, weight_path: str):
        super().__init__()
        with h5py.File(weight_path, 'r') as weights:
            # Conv1
            w1 = weights['conv1/conv1/kernel:0'][:] # (3, 5, 5, 3, 32)
            b1 = weights['conv1/conv1/bias:0'][:]
            self.conv1 = nn.Conv3d(3, 32, kernel_size=(3, 5, 5), stride=(1, 2, 2))
            self.conv1.weight.data = torch.from_numpy(w1.transpose(4, 3, 0, 1, 2)).float()
            self.conv1.bias.data = torch.from_numpy(b1).float()

            self.bn1 = nn.BatchNorm3d(32, eps=1e-3, momentum=0.01)
            self.bn1.weight.data = torch.from_numpy(weights['batc1/batc1/gamma:0'][:]).float()
            self.bn1.bias.data = torch.from_numpy(weights['batc1/batc1/beta:0'][:]).float()
            self.bn1.running_mean = torch.from_numpy(weights['batc1/batc1/moving_mean:0'][:]).float()
            self.bn1.running_var = torch.from_numpy(weights['batc1/batc1/moving_variance:0'][:]).float()

            # Conv2
            w2 = weights['conv2/conv2/kernel:0'][:] # (3, 5, 5, 32, 64)
            b2 = weights['conv2/conv2/bias:0'][:]
            self.conv2 = nn.Conv3d(32, 64, kernel_size=(3, 5, 5), stride=(1, 1, 1))
            self.conv2.weight.data = torch.from_numpy(w2.transpose(4, 3, 0, 1, 2)).float()
            self.conv2.bias.data = torch.from_numpy(b2).float()

            self.bn2 = nn.BatchNorm3d(64, eps=1e-3, momentum=0.01)
            self.bn2.weight.data = torch.from_numpy(weights['batc2/batc2/gamma:0'][:]).float()
            self.bn2.bias.data = torch.from_numpy(weights['batc2/batc2/beta:0'][:]).float()
            self.bn2.running_mean = torch.from_numpy(weights['batc2/batc2/moving_mean:0'][:]).float()
            self.bn2.running_var = torch.from_numpy(weights['batc2/batc2/moving_variance:0'][:]).float()

            # Conv3
            w3 = weights['conv3/conv3/kernel:0'][:] # (3, 3, 3, 64, 96)
            b3 = weights['conv3/conv3/bias:0'][:]
            self.conv3 = nn.Conv3d(64, 96, kernel_size=(3, 3, 3), stride=(1, 1, 1))
            self.conv3.weight.data = torch.from_numpy(w3.transpose(4, 3, 0, 1, 2)).float()
            self.conv3.bias.data = torch.from_numpy(b3).float()

            self.bn3 = nn.BatchNorm3d(96, eps=1e-3, momentum=0.01)
            self.bn3.weight.data = torch.from_numpy(weights['batc3/batc3/gamma:0'][:]).float()
            self.bn3.bias.data = torch.from_numpy(weights['batc3/batc3/beta:0'][:]).float()
            self.bn3.running_mean = torch.from_numpy(weights['batc3/batc3/moving_mean:0'][:]).float()
            self.bn3.running_var = torch.from_numpy(weights['batc3/batc3/moving_variance:0'][:]).float()

            # BiGRU 1
            bg1 = weights['bidirectional_1/bidirectional_1']
            self.gru1 = KerasBidirectionalGRU(
                bg1['kernel:0'][:], bg1['recurrent_kernel:0'][:], bg1['bias:0'][:],
                bg1['kernel_1:0'][:], bg1['recurrent_kernel_1:0'][:], bg1['bias_1:0'][:]
            )

            # BiGRU 2
            bg2 = weights['bidirectional_2/bidirectional_2']
            self.gru2 = KerasBidirectionalGRU(
                bg2['kernel:0'][:], bg2['recurrent_kernel:0'][:], bg2['bias:0'][:],
                bg2['kernel_1:0'][:], bg2['recurrent_kernel_1:0'][:], bg2['bias_1:0'][:]
            )

            # Dense / Softmax
            self.fc = nn.Linear(512, 28)
            self.fc.weight.data = torch.from_numpy(weights['dense1/dense1/kernel:0'][:].T).float()
            self.fc.bias.data = torch.from_numpy(weights['dense1/dense1/bias:0'][:]).float()

    def forward(self, x):
        """
        Input: (1, 3, T, 100, 50) float32 tensor in range [0, 1]
        Output: (T, 28) softmax probabilities
        """
        # zero1 pad: (2, 2, 2, 2, 1, 1) on (H, W, D)
        x = F.pad(x, (2, 2, 2, 2, 1, 1))
        x = F.relu(self.bn1(self.conv1(x)))
        x = F.max_pool3d(x, kernel_size=(1, 2, 2), stride=(1, 2, 2))

        # zero2 pad
        x = F.pad(x, (2, 2, 2, 2, 1, 1))
        x = F.relu(self.bn2(self.conv2(x)))
        x = F.max_pool3d(x, kernel_size=(1, 2, 2), stride=(1, 2, 2))

        # zero3 pad
        x = F.pad(x, (1, 1, 1, 1, 1, 1))
        x = F.relu(self.bn3(self.conv3(x)))
        x = F.max_pool3d(x, kernel_size=(1, 2, 2), stride=(1, 2, 2))

        # Flatten spatial dims per time step
        B, C, T, W_o, H_o = x.shape
        x = x[0].permute(1, 2, 3, 0).contiguous().view(T, -1) # (T, 1728)

        # Recurrent feature extraction
        x = self.gru1(x) # (T, 512)
        x = self.gru2(x) # (T, 512)

        # Linear projection to vocabulary
        logits = self.fc(x) # (T, 28)
        probs = F.softmax(logits, dim=-1)
        return probs
