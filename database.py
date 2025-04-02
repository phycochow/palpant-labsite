import pandas as pd

def get_data():
    return pd.DataFrame({
        f"Column {i}": [f"Value {i}.{j}" for j in range(1, 11)]
        for i in range(1, 11)
    })

if __name__ == '__main__':
    pass
