import pandas as pd

def get_data():
    return pd.DataFrame({
        'Protocol ID': ['CMPR-001', 'CMPR-002', 'CMPR-003'],
        'Media Type': ['RPMI with B27', 'DMEM + FA', 'DMEM'],
        'Cell Line': ['BJ1', 'Other', 'BJ1'],
        'Maturation': ['Wnt Modulation', 'Stromal Cell Inclusion', 'Matrix Stiffness']
    })

if __name__ == '__main__':
    pass
