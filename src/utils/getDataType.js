export const getDataTypeEnum = (dataType) => {
    switch (dataType) {
        case 'EHR':
            return 0;
        case 'PHR':
            return 1;
        case 'LAB_RESULT':
            return 2;
        case 'PRESCRIPTION':
            return 3;
        case 'IMAGING':
            return 4;
        case 'INSURANCE_CLAIM':
            return 5;
        case 'EMERGENCY_RECORD':
            return 6;
        default:
            return 1;
    }
};

export const getDataTypeName = (dataType) => {
    switch (dataType) {
        case 0:
            return 'EHR';
        case 1:
            return 'PHR';
        case 2:
            return 'Lab Results';
        case 3:
            return 'Prescription';
        case 4:
            return 'Imaging';
        case 5:
            return 'Insurance Claim';
        case 6:
            return 'Emergency Record';
        default:
            return 'NA';
    }
};

